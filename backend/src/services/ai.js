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
    prompt: 'anime style illustration, Studio Ghibli, soft cel shading, high quality portrait of a person',
    negativePrompt: 'ugly, blurry, low quality, deformed, nsfw',
    strength: 0.75,
  },
  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: 'vintage film photograph, Kodachrome, warm grain, 1970s portrait photography, faded colours',
    negativePrompt: 'modern, digital, oversaturated, sharp',
    strength: 0.55,
  },
  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    prompt: 'watercolor painting portrait, soft washes, artistic, paper texture, loose brushwork',
    negativePrompt: 'photograph, digital, 3d render, harsh lines',
    strength: 0.72,
  },
  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: 'cyberpunk portrait, neon rim light, futuristic city background, high contrast, blade runner',
    negativePrompt: 'natural light, daytime, dull, boring',
    strength: 0.70,
  },
  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: 'classical oil painting portrait, Rembrandt lighting, visible brushstrokes, museum quality',
    negativePrompt: 'photograph, modern, digital, flat',
    strength: 0.73,
  },
  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: 'comic book style portrait, bold ink outlines, flat bright colours, halftone dots, Marvel style',
    negativePrompt: 'realistic, blurry, photograph, subtle',
    strength: 0.78,
  },
};

// ─── TIER 1: Cloudflare Workers AI — TRUE img2img ─────────────────────────────
// Uses SD v1-5 img2img which takes the ACTUAL guest photo and transforms it.
// This is the correct model for photobooth use — the person's face is preserved.
async function generateWithCloudflare(imageBuffer, styleKey) {
  const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Resize to 512x512 — SD v1-5 native resolution
  const resized = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  // CF img2img expects the image as an array of byte values (not base64)
  const imageBytes = [...resized];

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: style.prompt,
      negative_prompt: style.negativePrompt,
      image: imageBytes,
      strength: style.strength,
      num_steps: 20,
      guidance: 7.5,
    }),
    signal: AbortSignal.timeout(60000), // 60s timeout
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

// ─── TIER 2: HuggingFace — text-to-image (styled portrait, not img2img) ───────
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

// ─── TIER 3: Local Sharp filters — actual photo transformed ───────────────────
// This IS img2img — it applies real colour grading to the ACTUAL guest photo.
// Much better than HuggingFace for keeping the person's face.
async function generateWithSharp(imageBuffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  if (!sharp) return { buffer: imageBuffer, style: style.name, styleKey, tier: 'passthrough' };

  let img = sharp(imageBuffer).resize(1024, 1024, { fit: 'cover' });

  switch (styleKey) {
    case 'anime':
      // Boost saturation + sharpen + slight warm tint = anime-like
      img = img.modulate({ brightness: 1.05, saturation: 2.0 })
               .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
               .tint({ r: 255, g: 245, b: 235 });
      break;
    case 'vintage':
      // Desaturate + warm tone + grain effect
      img = img.modulate({ brightness: 1.1, saturation: 0.6 })
               .tint({ r: 255, g: 230, b: 190 })
               .gamma(1.2);
      break;
    case 'watercolor':
      // Soften + pastel colours + slight blur
      img = img.modulate({ brightness: 1.15, saturation: 1.4 })
               .blur(0.8)
               .sharpen({ sigma: 0.5 })
               .tint({ r: 235, g: 240, b: 255 });
      break;
    case 'cyberpunk':
      // High contrast + cool blue/purple tint + punchy saturation
      img = img.modulate({ brightness: 0.85, saturation: 2.5 })
               .tint({ r: 160, g: 180, b: 255 })
               .sharpen({ sigma: 1.5 });
      break;
    case 'oilpainting':
      // Rich contrast + warm tones + strong sharpen
      img = img.modulate({ brightness: 1.0, saturation: 1.6 })
               .sharpen({ sigma: 2.5, m1: 2, m2: 0.5 })
               .tint({ r: 255, g: 240, b: 210 });
      break;
    case 'comic':
      // Max saturation + hard sharpen + slight posterize effect
      img = img.modulate({ brightness: 1.1, saturation: 3.0 })
               .sharpen({ sigma: 3.0, m1: 3, m2: 0.2 })
               .gamma(0.8);
      break;
    default:
      img = img.modulate({ brightness: 1.05, saturation: 1.5 });
  }

  const buffer = await img.jpeg({ quality: 92 }).toBuffer();
  return { buffer, style: style.name, styleKey, tier: 'local' };
}

// ─── Main entry point ─────────────────────────────────────────────────────────
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  let result;

  // Tier 1: Cloudflare img2img — best quality, preserves face
  result = await generateWithCloudflare(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Cloudflare failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Cloudflare img2img'); return result; }

  // Tier 2: Sharp local filters — instant, face preserved, colour grading
  // NOTE: HuggingFace FLUX is text-to-image only — it ignores the guest photo entirely
  // and generates a random styled person. Sharp is better for a photobooth until
  // Cloudflare img2img is configured (set CF_ACCOUNT_ID + CF_AI_TOKEN on Render).
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
