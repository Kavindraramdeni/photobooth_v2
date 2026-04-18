/**
 * backend/src/services/ai.js
 *
 * AI image generation with three-tier approach:
 *
 * TIER 1 — Cloudflare Workers AI (FREE up to 10k requests/day)
 *   Model: @cf/runwayml/stable-diffusion-v1-5-img2img  ← TRUE img2img, transforms YOUR photo
 *   Requires: CF_ACCOUNT_ID + CF_AI_TOKEN env vars
 *   Get free at: dash.cloudflare.com → AI → Workers AI → API Token
 *
 * TIER 2 — HuggingFace Inference API (FREE, slower)
 *   Uses FLUX.1-schnell — text-to-image only (no img2img on free tier)
 *   NOTE: Result will NOT match the guest's face — it's a styled image, not a transformation
 *   Requires: HUGGINGFACE_API_TOKEN env var
 *
 * TIER 3 — Local Sharp filters (INSTANT, zero cost, always works)
 *   Real colour grading applied to the actual guest photo
 *   Looks like Instagram filters — quick and reliable
 */

let sharp;
try {
  sharp = require('sharp');
} catch(e) {
  console.error('[ai] sharp failed to load:', e.message);
}

const AI_STYLES = {

  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    prompt: 'Transform this into a Studio Ghibli anime illustration with soft cel-shading, luminous eyes, and a painterly background.',
    negativePrompt: 'ugly, deformed, watermark, text, nsfw',
    strength: 0.80,
  },

  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: 'Transform this into a warm Kodachrome 1970s film photograph with lifted shadows, grain, and amber colour cast.',
    negativePrompt: 'modern, digital, HDR, cold tones',
    strength: 0.60,
  },

  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    prompt: 'Transform this into a delicate watercolor portrait with soft washes, visible brushstrokes, and luminous white paper showing through.',
    negativePrompt: 'digital, harsh lines, overworked',
    strength: 0.75,
  },

  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: 'Transform this into a Blade Runner cyberpunk portrait with electric neon rim lighting, rain-soaked megacity backdrop, and glowing holographic effects.',
    negativePrompt: 'daytime, natural light, cartoon, anime',
    strength: 0.82,
  },

  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: 'Transform this into a Rembrandt-style oil painting with rich impasto texture, warm candlelight, and deep chiaroscuro shadows.',
    negativePrompt: 'modern, digital, cartoon, flat',
    strength: 0.78,
  },

  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: 'Transform this into a Marvel comic book panel with bold ink outlines, flat cel-shaded colours, and Ben-Day halftone dots.',
    negativePrompt: 'realistic, soft, painterly, anime',
    strength: 0.82,
  },

  renaissance: {
    name: 'Renaissance',
    emoji: '🎨',
    prompt: 'Transform this into a Leonardo da Vinci Renaissance oil portrait with sfumato shading, warm amber light, and a dark classical background.',
    negativePrompt: 'modern, cartoon, digital, flat',
    strength: 0.78,
  },

  statue: {
    name: 'Marble Statue',
    emoji: '🏛️',
    prompt: 'Transform this person into a classical white Carrara marble sculpture with realistic stone texture, grey veining, and dramatic museum lighting.',
    negativePrompt: 'color, painted, modern, cartoon',
    strength: 0.85,
  },

  eighties: {
    name: '80s Yearbook',
    emoji: '✨',
    prompt: 'Transform this into a 1986 high school yearbook portrait with big hair, period clothing, gradient blue studio backdrop, and warm flash photography.',
    negativePrompt: 'modern, 21st century, digital clean',
    strength: 0.72,
  },

  psychedelic: {
    name: 'Psychedelic',
    emoji: '🌈',
    prompt: 'Transform this into a 1967 psychedelic concert poster illustration with swirling rainbow patterns, acid colours at full saturation, and organic flowing shapes.',
    negativePrompt: 'realistic, muted, grayscale, text',
    strength: 0.85,
  },

  pixelart: {
    name: '8-bit Pixel',
    emoji: '🎮',
    prompt: 'Transform this into a cute 8-bit pixel art character on a colourful retro game background with large visible pixels and a limited 16-colour palette.',
    negativePrompt: 'smooth, antialiased, photorealistic, high detail',
    strength: 0.88,
  },

  daguerreotype: {
    name: '19th Century',
    emoji: '🎩',
    prompt: 'Transform this into an 1858 daguerreotype portrait in sepia silver tones with Victorian clothing, studio draping, and soft period lens focus.',
    negativePrompt: 'modern, colour, casual clothing, digital',
    strength: 0.75,
  },

  old: {
    name: 'Aged',
    emoji: '👴',
    prompt: 'Age this person to 90 years old with deep wrinkles, liver spots, white hair, sagging skin — completely photorealistic age progression.',
    negativePrompt: 'young, smooth, cartoon, painted',
    strength: 0.78,
  },

};


// ─── TIER 1: Gemini — native img2img with face preservation ──────────────────
// Uses @google/genai SDK with gemini-2.0-flash-exp model
// Same approach as gembooth — SDK handles the image modality correctly
async function generateWithGemini(imageBuffer, styleKey, customPrompt = null) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;

  // Load @google/genai SDK
  let GoogleGenAI, Modality;
  try {
    const sdk = require('@google/genai');
    GoogleGenAI = sdk.GoogleGenAI;
    Modality = sdk.Modality;
    if (!GoogleGenAI) throw new Error('GoogleGenAI not found in SDK exports');
    console.log('[Gemini] SDK loaded, Modality:', !!Modality);
  } catch (e) {
    console.warn('[Gemini] SDK load failed:', e.message);
    console.warn('[Gemini] Install with: npm install @google/genai');
    return null;
  }

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  const resized = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = resized.toString('base64');

  // Use custom admin prompt if provided, otherwise use hardcoded style prompt
  const basePrompt = customPrompt || style.prompt || 'Transform in an artistic style.';
  const prompt = basePrompt.endsWith('facial identity.')
    ? basePrompt  // already has the preservation instruction
    : basePrompt + " Preserve the person's facial identity.";

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
  console.log('[Gemini] Attempting generation, key length:', GEMINI_KEY.length);

  // Model confirmed working in gembooth (same SDK)
  const MODEL_NAMES = [
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-preview-image-generation',
  ];

  for (const modelName of MODEL_NAMES) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        config: {
          responseModalities: Modality
            ? [Modality.TEXT, Modality.IMAGE]
            : ['TEXT', 'IMAGE'],
        },
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/jpeg',
              },
            },
            { text: prompt },
          ],
        }],
      });

      // Find the image part in the response
      const parts = response?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.data);

      if (!imagePart) {
        console.warn(`[Gemini] ${modelName}: no image in response`);
        continue;
      }

      console.log(`[Gemini] ✅ Generated via ${modelName}`);
      const outputBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      return { buffer: outputBuffer, style: style.name, styleKey, tier: 'gemini' };

    } catch (err) {
      console.warn(`[Gemini] ${modelName} error:`, err.message?.slice(0, 150));
      continue;
    }
  }

  throw new Error('Gemini: all models failed — check GEMINI_API_KEY and account access');
}


async function generateWithFal(imageBuffer, styleKey) {
  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Convert image to base64 data URL for Fal
  const resized = await sharp(imageBuffer)
    .resize(768, 768, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${resized.toString('base64')}`;

  // FLUX.1-schnell img2img — fast, cinematic quality, face preserved
  const res = await fetch('https://fal.run/fal-ai/flux/schnell/image-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: base64Image,
      prompt: style.prompt,
      negative_prompt: style.negativePrompt,
      strength: style.strength,
      num_inference_steps: 4,
      guidance_scale: 3.5,
      num_images: 1,
      image_size: 'square_hd',
      enable_safety_checker: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Fal.ai failed:', res.status, err.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) { console.warn('[AI] Fal.ai: no image URL in response'); return null; }

  // Download the generated image
  const imgRes = await fetch(imageUrl);
  const outputBuffer = await sharp(Buffer.from(await imgRes.arrayBuffer()))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'fal' };
}

// ─── TIER 2: Cloudflare Workers AI — img2img (free, good quality) ─────────────
// Uses SD v1-5 img2img which takes the ACTUAL guest photo and transforms it.
// This is the correct model for photobooth use — the person's face is preserved.
async function generateWithCloudflare(imageBuffer, styleKey) {
  const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Resize to 512x512 — SD v1-5 native resolution, use JPEG to keep payload small
  const resized = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85 })
    .toBuffer();

  // CF Workers AI img2img expects JSON with image as number array
  const imageArray = Array.from(resized);

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: (style.prompt || 'artistic style transfer').slice(0, 500),
      negative_prompt: style.negativePrompt || 'blurry, low quality',
      strength: style.strength || 0.75,
      num_steps: 20,
      guidance: 7.5,
      image: imageArray,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Cloudflare img2img failed:', res.status, err.slice(0, 300));
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'cloudflare' };
}

// ─── TIER 3: HuggingFace — text-to-image fallback ──────────────────────────────
// IMPORTANT: This generates a NEW styled portrait from the prompt.
// The guest's face is NOT preserved. Used only when Cloudflare is unavailable.
const HF_MODELS = {
  anime:       'black-forest-labs/FLUX.1-schnell',
  vintage:     'black-forest-labs/FLUX.1-schnell',
  watercolor:  'black-forest-labs/FLUX.1-schnell',
  cyberpunk:   'black-forest-labs/FLUX.1-schnell',
  oilpainting: 'black-forest-labs/FLUX.1-schnell',
  comic:       'black-forest-labs/FLUX.1-schnell',
};

async function generateWithHuggingFace(imageBuffer, styleKey) {
  const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
  if (!HF_TOKEN) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  const model = HF_MODELS[styleKey] || HF_MODELS.anime;
  const prompt = `${style.prompt}, photobooth photo, high quality, one person`;

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { num_inference_steps: 4, width: 512, height: 512 },
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 503) {
      let waitTime = 30;
      try { waitTime = JSON.parse(err).estimated_time || 30; } catch {}
      throw new Error(`MODEL_LOADING:${Math.ceil(waitTime)}`);
    }
    console.warn('[AI] HuggingFace failed:', res.status, err.slice(0, 200));
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  // Mark as text2img so frontend can show a note if desired
  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'huggingface', isText2Image: true };
}

// ─── Sharp colour grading — professional per-style looks ─────────────────────
// Each style applies a distinct cinematic grade. Face always preserved.
async function generateWithSharp(imageBuffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  if (!sharp) return { buffer: imageBuffer, style: style.name, styleKey, tier: 'passthrough' };

  let img = sharp(imageBuffer).resize(1024, 1024, { fit: 'cover' });

  switch (styleKey) {
    case 'anime':
      // Vivid pop: high saturation, clean whites, strong sharpen — anime cel feel
      img = img
        .modulate({ brightness: 1.08, saturation: 2.2, hue: 5 })
        .sharpen({ sigma: 1.8, m1: 2.0, m2: 0.5 })
        .tint({ r: 252, g: 240, b: 255 })
        .gamma(0.92);
      break;

    case 'cyberpunk':
      // Dark neon: crushed blacks, electric blue-violet cast, hyper saturation
      img = img
        .modulate({ brightness: 0.78, saturation: 2.8, hue: -15 })
        .tint({ r: 120, g: 160, b: 255 })
        .sharpen({ sigma: 2.0, m1: 2.5, m2: 0.3 })
        .gamma(0.75);
      break;

    case 'vintage':
      // Kodachrome: lifted shadows, warm amber-orange cast, reduced saturation
      img = img
        .modulate({ brightness: 1.12, saturation: 0.55, hue: 10 })
        .tint({ r: 255, g: 225, b: 175 })
        .gamma(1.35)
        .blur(0.4);
      break;

    case 'renaissance':
      // Old master: warm candlelight, rich deep shadows, soft highlights
      img = img
        .modulate({ brightness: 0.92, saturation: 0.85, hue: 8 })
        .tint({ r: 255, g: 220, b: 165 })
        .sharpen({ sigma: 1.0, m1: 1.2, m2: 0.8 })
        .gamma(1.15);
      break;

    case 'comic':
      // Bold pop art: extreme saturation, hard edges, punchy contrast
      img = img
        .modulate({ brightness: 1.15, saturation: 3.5, hue: 0 })
        .sharpen({ sigma: 3.5, m1: 4.0, m2: 0.1 })
        .gamma(0.78);
      break;

    case 'statue':
      // White marble: full desaturate, high key, cool white tone
      img = img
        .modulate({ brightness: 1.3, saturation: 0.0 })
        .tint({ r: 240, g: 243, b: 255 })
        .sharpen({ sigma: 1.5, m1: 1.8, m2: 0.6 })
        .gamma(0.88);
      break;

    case 'eighties':
      // 80s chrome: warm magenta-pink cast, slight overexposure, soft glow
      img = img
        .modulate({ brightness: 1.18, saturation: 1.6, hue: -8 })
        .tint({ r: 255, g: 200, b: 220 })
        .blur(0.5)
        .sharpen({ sigma: 0.8 })
        .gamma(0.95);
      break;

    case 'psychedelic':
      // Acid trip: rotated hues, max saturation, high brightness
      img = img
        .modulate({ brightness: 1.2, saturation: 4.0, hue: 120 })
        .sharpen({ sigma: 1.0 })
        .gamma(0.85);
      break;

    case 'pixelart':
      // 8-bit: posterize via resize trick, vivid flat colours
      img = img
        .resize(80, 80, { fit: 'cover', kernel: 'nearest' })
        .resize(1024, 1024, { fit: 'cover', kernel: 'nearest' })
        .modulate({ brightness: 1.1, saturation: 2.5 })
        .sharpen({ sigma: 0.5 });
      break;

    case 'daguerreotype':
      // 19th century: sepia, heavy vignette feel, low contrast matte
      img = img
        .modulate({ brightness: 0.95, saturation: 0.0 })
        .tint({ r: 210, g: 175, b: 130 })
        .gamma(1.4)
        .blur(0.6);
      break;

    case 'oilpainting':
      // Rich oil: deep warm tones, strong texture sharpen, lifted blacks
      img = img
        .modulate({ brightness: 1.02, saturation: 1.8, hue: 5 })
        .sharpen({ sigma: 3.0, m1: 3.0, m2: 0.4 })
        .tint({ r: 255, g: 238, b: 205 })
        .gamma(1.1);
      break;

    case 'old':
      // Aged face: desaturate, lower contrast, slight yellow skin cast
      img = img
        .modulate({ brightness: 0.96, saturation: 0.5 })
        .tint({ r: 245, g: 225, b: 195 })
        .blur(0.3)
        .sharpen({ sigma: 0.6 })
        .gamma(1.2);
      break;

    default:
      img = img.modulate({ brightness: 1.05, saturation: 1.6 });
  }

  const buffer = await img.jpeg({ quality: 94 }).toBuffer();
  return { buffer, style: style.name, styleKey, tier: 'local' };
}

// ─── Main entry point ─────────────────────────────────────────────────────────
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  let result;

  // Tier 1: Gemini — highest quality, face preserved, style transfer
  result = await generateWithGemini(imageBuffer, styleKey, customPrompt).catch(err => {
    console.warn('[AI] Gemini failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Gemini (cinematic quality)'); return result; }

  // Tier 2: Fal.ai FLUX img2img — cinematic quality, face preserved
  result = await generateWithFal(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Fal.ai failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Fal.ai FLUX'); return result; }

  // Cloudflare SD v1.5 skipped — output quality too low for photobooth events

  // Final fallback: Sharp local filters — instant, face always preserved
  // Clean colour grading applied per style. Not "AI art" but professional quality.
  result = await generateWithSharp(imageBuffer, styleKey);
  console.log('[AI] ✅ Generated via local Sharp filters (face preserved)');
  return result;

  // Tier 3: HuggingFace — disabled for now (text2img, does not use guest photo)
  // Re-enable below once CF img2img is set up, as a fallback for style variety
  // try {
  //   result = await generateWithHuggingFace(imageBuffer, styleKey);
  // } catch (err) {
  //   if (err.message.startsWith('MODEL_LOADING:')) throw err;
  // }
}

// ─── Apply filter only (no generation) ───────────────────────────────────────
async function applyAIFilter(imageBuffer, styleKey) {
  return generateWithSharp(imageBuffer, styleKey);
}

module.exports = { generateAIImage, applyAIFilter, AI_STYLES };

// ══ NOTE: Replace the AI_STYLES const at the top of this file ══
// The full premium prompts are in ai_prompts_update.js
// Key changes:
// 1. All prompts now explicitly handle multi-person / group photos
// 2. Face preservation instruction in every single prompt
// 3. Much richer style descriptions for better Gemini output
// 4. Group photo instructions for 2+ people
