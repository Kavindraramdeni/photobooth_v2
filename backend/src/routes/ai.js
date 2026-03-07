/**
 * backend/src/services/ai.js
 *
 * AI image generation using fal.ai (https://fal.ai)
 * - Real img2img: guest's actual face is preserved in the art style
 * - 2-5 second generation (vs 30-90s on HuggingFace free tier)
 * - Pay per generation: ~$0.003-0.006 per image
 * - No cold starts, no 410/503 model retirement issues
 *
 * Required env var on Render:
 *   FAL_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   Get it free at: https://fal.ai → Dashboard → API Keys
 *   Free tier includes $5 credit (≈ 1000 images)
 *
 * Fallback (if FAL_KEY not set):
 *   Uses Sharp to apply instant local filters — no AI, but works immediately.
 */

const sharp = require('sharp');

const AI_STYLES = {
  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    prompt: 'anime style illustration, Studio Ghibli aesthetic, soft shading, high quality, detailed face',
    negativePrompt: 'ugly, blurry, low quality, deformed, extra limbs',
    strength: 0.75,
  },
  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: 'vintage film photograph, Kodachrome colours, film grain, warm tones, 1970s portrait photography',
    negativePrompt: 'modern, digital, oversaturated, sharp',
    strength: 0.6,
  },
  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    prompt: 'beautiful watercolor painting, artistic, soft colours, visible brushstrokes, paper texture',
    negativePrompt: 'photograph, digital art, 3d render',
    strength: 0.8,
  },
  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: 'cyberpunk portrait, neon lights, futuristic, dramatic rim lighting, blade runner aesthetic, high contrast',
    negativePrompt: 'natural lighting, daytime, bright, plain background',
    strength: 0.75,
  },
  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: 'classical oil painting portrait, impressionist brushstrokes, museum quality, Rembrandt lighting',
    negativePrompt: 'photograph, modern, digital, cartoon',
    strength: 0.78,
  },
  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: 'comic book style portrait, bold ink outlines, bright flat colours, halftone dots, Marvel Comics style',
    negativePrompt: 'realistic, photograph, blurry',
    strength: 0.82,
  },
};

/**
 * Call fal.ai img2img endpoint.
 * Uses fal-ai/ip-adapter-face-id — preserves the person's face in the art style.
 *
 * @param {Buffer} imageBuffer  Original photo
 * @param {string} styleKey     Key from AI_STYLES
 * @param {string|null} customPrompt  Optional override
 * @returns {{ buffer: Buffer, style: string, styleKey: string }}
 */
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  if (!process.env.FAL_KEY) {
    console.warn('[AI] FAL_KEY not set — applying local Sharp filter as fallback');
    return applyLocalStyleFilter(imageBuffer, styleKey);
  }

  // Resize to 768x768 — optimal for fal.ai models, balances quality vs speed
  const resized = await sharp(imageBuffer)
    .resize(768, 768, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 92 })
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${resized.toString('base64')}`;
  const prompt = customPrompt || style.prompt;

  // Use flux/dev with image-to-image — widely supported, no model retirement
  const payload = {
    prompt,
    negative_prompt: style.negativePrompt,
    image_url: base64Image,
    strength: style.strength,
    num_inference_steps: 28,
    guidance_scale: 7.5,
    num_images: 1,
    enable_safety_checker: false,
  };

  const res = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[AI] fal.ai error:', res.status, errText);

    // Try fallback model if primary fails
    if (res.status === 422 || res.status === 404) {
      return generateWithFallbackModel(resized, prompt, style, styleKey);
    }
    throw new Error(`AI generation failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const imageUrl = data?.images?.[0]?.url || data?.image?.url;

  if (!imageUrl) {
    console.error('[AI] Unexpected fal.ai response:', JSON.stringify(data).slice(0, 300));
    throw new Error('AI returned no image. Unexpected response format.');
  }

  // Fetch the generated image and return as buffer
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Could not fetch generated image from fal.ai');
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  // Upscale to 1024 for sharing
  const finalBuffer = await sharp(imgBuffer)
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { buffer: finalBuffer, style: style.name, styleKey };
}

/**
 * Fallback: try fal-ai/stable-diffusion-v3-medium if flux fails
 */
async function generateWithFallbackModel(resizedBuffer, prompt, style, styleKey) {
  console.log('[AI] Trying fallback model: stable-diffusion-v3-medium');

  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;

  const res = await fetch('https://fal.run/fal-ai/stable-diffusion-v3-medium/image-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: style.negativePrompt,
      image_url: base64Image,
      strength: style.strength,
      num_inference_steps: 25,
      num_images: 1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fallback model also failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('Fallback model returned no image');

  const imgRes = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const finalBuffer = await sharp(imgBuffer)
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { buffer: finalBuffer, style: style.name, styleKey };
}

/**
 * Apply instant local filters using Sharp (no API, no cost, instant).
 * Used as fallback when FAL_KEY is not set.
 */
async function applyLocalStyleFilter(imageBuffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  let img = sharp(imageBuffer).resize(1024, 1024, { fit: 'cover' });

  switch (styleKey) {
    case 'vintage':
      img = img.modulate({ brightness: 1.05, saturation: 0.7 }).tint({ r: 255, g: 240, b: 200 });
      break;
    case 'watercolor':
      img = img.modulate({ brightness: 1.1, saturation: 1.2 }).blur(0.5).sharpen({ sigma: 0.5 });
      break;
    case 'cyberpunk':
      img = img.modulate({ brightness: 0.9, saturation: 2.0 }).tint({ r: 200, g: 220, b: 255 });
      break;
    case 'oilpainting':
      img = img.modulate({ brightness: 1.0, saturation: 1.3 }).sharpen({ sigma: 1.5 });
      break;
    case 'comic':
      img = img.modulate({ brightness: 1.1, saturation: 2.5 }).sharpen({ sigma: 2 });
      break;
    default: // anime
      img = img.modulate({ brightness: 1.05, saturation: 1.6 }).sharpen({ sigma: 1 });
  }

  const buffer = await img.jpeg({ quality: 95 }).toBuffer();
  return { buffer, style: style.name, styleKey };
}

/**
 * Apply instant Sharp filter (used for the quick filter buttons, not full AI gen)
 */
async function applyAIFilter(imageBuffer, filterName) {
  const filters = {
    bw:        (img) => img.grayscale(),
    warm:      (img) => img.modulate({ brightness: 1.05, saturation: 1.2 }).tint({ r: 255, g: 240, b: 210 }),
    cool:      (img) => img.modulate({ brightness: 1.05, saturation: 1.1 }).tint({ r: 210, g: 230, b: 255 }),
    vivid:     (img) => img.modulate({ brightness: 1.1, saturation: 1.9 }),
    fade:      (img) => img.modulate({ brightness: 1.15, saturation: 0.55 }),
    dramatic:  (img) => img.modulate({ brightness: 0.85, saturation: 1.4 }).linear(1.25, -25),
    sepia:     (img) => img.grayscale().tint({ r: 112, g: 66, b: 20 }),
    vivid:     (img) => img.modulate({ brightness: 1.1, saturation: 2.0 }),
  };

  const filterFn = filters[filterName] || filters.bw;
  return await filterFn(sharp(imageBuffer)).jpeg({ quality: 95 }).toBuffer();
}

module.exports = { generateAIImage, applyAIFilter, AI_STYLES };
