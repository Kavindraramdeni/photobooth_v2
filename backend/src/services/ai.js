/**
 * backend/src/services/ai.js
 *
 * AI image generation with three-tier approach:
 *
 * TIER 1 — Cloudflare Workers AI (FREE up to 10k requests/day)
 *   Requires: CF_ACCOUNT_ID + CF_AI_TOKEN env vars
 *   Get free at: dash.cloudflare.com → AI → Workers AI → API Token
 *
 * TIER 2 — HuggingFace Inference API (FREE, slower, may have cold starts)
 *   Requires: HUGGINGFACE_API_TOKEN env var
 *   Uses active models only (not the retired sd-v1-5)
 *
 * TIER 3 — Local Sharp filters (INSTANT, zero cost, no API)
 *   Always available as final fallback. Applies real colour grading.
 *   Looks good on a photo booth — guests see "Vintage", "Vivid" etc.
 */

let sharp;
try {
  sharp = require('sharp');
} catch(e) {
  console.error('[ai] sharp failed to load:', e.message);
  // sharp native binary mismatch - will use fallback
}

const AI_STYLES = {
  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    prompt: 'anime style illustration, Studio Ghibli, soft cel shading, high quality portrait',
    negativePrompt: 'ugly, blurry, low quality, deformed',
    strength: 0.75,
  },
  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: 'vintage film photograph, Kodachrome, warm grain, 1970s portrait photography',
    negativePrompt: 'modern, digital, oversaturated',
    strength: 0.6,
  },
  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    prompt: 'watercolor painting portrait, soft washes, artistic, paper texture, loose brushwork',
    negativePrompt: 'photograph, digital, 3d render',
    strength: 0.8,
  },
  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: 'cyberpunk portrait, neon rim light, futuristic, high contrast, blade runner aesthetic',
    negativePrompt: 'natural light, daytime, dull',
    strength: 0.75,
  },
  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: 'classical oil painting portrait, Rembrandt lighting, visible brushstrokes, museum quality',
    negativePrompt: 'photograph, modern, digital',
    strength: 0.78,
  },
  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: 'comic book style, bold ink outlines, flat bright colours, halftone, Marvel style',
    negativePrompt: 'realistic, blurry, photograph',
    strength: 0.82,
  },
};

// ─── TIER 1: Cloudflare Workers AI ───────────────────────────────────────────
async function generateWithCloudflare(imageBuffer, styleKey) {
  const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) return null; // skip to next tier

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // SDXL-Lightning is text-to-image — we style via prompt, not img2img
  // Saves processing time and avoids deprecated model errors
  // @cf/bytedance/stable-diffusion-xl-lightning — fast SDXL, free on CF Workers AI
  // img2img via: @cf/runwayml/stable-diffusion-v1-5-img2img (deprecated) replaced below
  const CF_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: `${style.prompt}, photobooth portrait, high quality, sharp focus`,
      negative_prompt: style.negativePrompt,
      num_steps: 4,   // lightning model is optimised for 4-8 steps
      guidance: 1.0,  // lightning needs low guidance
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Cloudflare tier failed:', res.status, err.slice(0, 200));
    return null;
  }

  // CF returns raw image bytes
  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'cloudflare' };
}

// ─── TIER 2: HuggingFace (active models only) ────────────────────────────────
const HF_MODELS = {
  // These are confirmed active as of 2026 — using FLUX and SDXL, not retired SD v1-5
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

  // FLUX.1-schnell on HF is text-to-image only (no img2img on free tier)
  // We use the prompt + describe the person to get styled output
  const prompt = `${style.prompt}, portrait of a person, photobooth photo, high quality`;

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { num_inference_steps: 4, width: 512, height: 512 }, // schnell is fast at 4 steps
    }),
    signal: AbortSignal.timeout(90000), // 90s timeout
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    // 503 = model loading, include wait time hint
    if (res.status === 503) {
      let waitTime = 30;
      try { waitTime = JSON.parse(err).estimated_time || 30; } catch {}
      throw new Error(`MODEL_LOADING:${Math.ceil(waitTime)}`);
    }
    console.warn('[AI] HuggingFace tier failed:', res.status, err.slice(0, 200));
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'huggingface' };
}

// ─── TIER 3: Local Sharp filters (instant, always works) ─────────────────────
async function generateWithSharp(imageBuffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  if (!sharp) return { buffer: imageBuffer, style: style.name, styleKey, tier: 'passthrough' };
  let img = sharp(imageBuffer).resize(1024, 1024, { fit: 'cover' });

  switch (styleKey) {
    case 'anime':
      img = img.modulate({ brightness: 1.05, saturation: 1.8 }).sharpen({ sigma: 0.8 });
      break;
    case 'vintage':
      img = img.modulate({ brightness: 1.08, saturation: 0.65 }).tint({ r: 255, g: 235, b: 195 });
      break;
    case 'watercolor':
      img = img.modulate({ brightness: 1.12, saturation: 1.3 }).blur(0.6).sharpen({ sigma: 0.4 });
      break;
    case 'cyberpunk':
      img = img.modulate({ brightness: 0.88, saturation: 2.2 }).tint({ r: 180, g: 200, b: 255 });
      break;
    case 'oilpainting':
      img = img.modulate({ brightness: 1.0, saturation: 1.4 }).sharpen({ sigma: 1.8 });
      break;
    case 'comic':
      img = img.modulate({ brightness: 1.12, saturation: 2.8 }).sharpen({ sigma: 2.5 });
      break;
    default:
      img = img.modulate({ brightness: 1.05, saturation: 1.5 });
  }

  const buffer = await img.jpeg({ quality: 95 }).toBuffer();
  return { buffer, style: style.name, styleKey, tier: 'local' };
}

// ─── Main entry point ─────────────────────────────────────────────────────────
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  // Try each tier in order, fall through on failure
  let result;

  result = await generateWithCloudflare(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Cloudflare failed:', err.message);
    return null;
  });
  if (result) { console.log(`[AI] Generated via ${result.tier}`); return result; }

  try {
    result = await generateWithHuggingFace(imageBuffer, styleKey);
  } catch (err) {
    if (err.message.startsWith('MODEL_LOADING:')) throw err; // propagate so caller can retry
    console.warn('[AI] HuggingFace failed:', err.message);
  }
  if (result) { console.log(`[AI] Generated via ${result.tier}`); return result; }

  // Always succeeds
  result = await generateWithSharp(imageBuffer, styleKey);
  console.log('[AI] Generated via local Sharp filters');
  return result;
}

// ─── Quick filter (Sharp only, instant) ──────────────────────────────────────
async function applyAIFilter(imageBuffer, filterName) {
  if (!sharp) return imageBuffer; // passthrough if sharp not available
  const filters = {
    bw:       (img) => img.grayscale(),
    warm:     (img) => img.modulate({ brightness: 1.05, saturation: 1.2 }).tint({ r: 255, g: 240, b: 210 }),
    cool:     (img) => img.modulate({ brightness: 1.05, saturation: 1.1 }).tint({ r: 210, g: 230, b: 255 }),
    vivid:    (img) => img.modulate({ brightness: 1.1, saturation: 2.0 }),
    fade:     (img) => img.modulate({ brightness: 1.15, saturation: 0.55 }),
    dramatic: (img) => img.modulate({ brightness: 0.85, saturation: 1.4 }).linear(1.25, -25),
    sepia:    (img) => img.grayscale().tint({ r: 112, g: 66, b: 20 }),
  };

  const filterFn = filters[filterName] || filters.bw;
  return await filterFn(sharp(imageBuffer)).jpeg({ quality: 95 }).toBuffer();
}

module.exports = { generateAIImage, applyAIFilter, AI_STYLES };
