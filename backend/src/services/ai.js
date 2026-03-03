'use strict';
/**
 * backend/src/services/ai.js
 *
 * PHASE 1: Sharp-based instant filters.
 * Replaces broken HuggingFace service completely.
 * Route (backend/src/routes/ai.js) requires ZERO changes.
 * Results are instant — typically under 500ms.
 */

const sharp = require('sharp');

// ── Style catalogue ─────────────────────────────────────────────────────
const AI_STYLES = {
  bw_film: {
    name: 'B&W Film',
    emoji: '🎞️',
    desc: 'Classic black & white with subtle grain',
  },
  vintage: {
    name: 'Vintage',
    emoji: '🌅',
    desc: 'Warm faded tones from the 70s',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    desc: 'Electric cyan & neon glow',
  },
  warm_glow: {
    name: 'Warm Glow',
    emoji: '✨',
    desc: 'Golden hour warmth & soft bloom',
  },
  cool_fade: {
    name: 'Cool Fade',
    emoji: '🧊',
    desc: 'Airy blue-silver editorial look',
  },
  high_contrast: {
    name: 'High Contrast',
    emoji: '⚡',
    desc: 'Punchy shadows, bold highlights',
  },
};

// ── Filters ─────────────────────────────────────────────────────────────

async function applyBWFilm(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  const pixels = width * height;
  const grain = Buffer.alloc(pixels);
  for (let i = 0; i < pixels; i++) grain[i] = Math.floor(Math.random() * 30);
  const grainPng = await sharp(grain, { raw: { width, height, channels: 1 } }).png().toBuffer();

  return sharp(buffer)
    .greyscale()
    .linear(1.12, -8)
    .composite([{ input: grainPng, blend: 'screen', opacity: 0.1 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function applyVintage(buffer) {
  return sharp(buffer)
    .modulate({ saturation: 0.60, hue: 12 })
    .linear(0.86, 24)
    .tint({ r: 255, g: 228, b: 175 })
    .gamma(1.1)
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function applyCyberpunk(buffer) {
  const boosted = await sharp(buffer)
    .modulate({ saturation: 2.5, hue: -20 })
    .linear(1.25, -20)
    .toBuffer();
  return sharp(boosted)
    .tint({ r: 20, g: 255, b: 240 })
    .modulate({ brightness: 0.93 })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function applyWarmGlow(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  const bloom = await sharp(buffer)
    .blur(20)
    .modulate({ brightness: 1.4, saturation: 1.5 })
    .tint({ r: 255, g: 200, b: 100 })
    .resize(width, height)
    .toBuffer();
  return sharp(buffer)
    .tint({ r: 255, g: 218, b: 148 })
    .modulate({ brightness: 1.07, saturation: 1.3 })
    .composite([{ input: bloom, blend: 'screen', opacity: 0.15 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function applyCoolFade(buffer) {
  return sharp(buffer)
    .modulate({ saturation: 0.65, hue: -8 })
    .linear(0.78, 32)
    .tint({ r: 170, g: 205, b: 255 })
    .gamma(0.92)
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function applyHighContrast(buffer) {
  return sharp(buffer)
    .modulate({ saturation: 1.7, brightness: 1.04 })
    .linear(1.5, -40)
    .gamma(0.85)
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ── Dispatcher ───────────────────────────────────────────────────────────

async function applyAIFilter(inputBuffer, filterName) {
  const key = (filterName || 'bw_film').toLowerCase().replace(/[\s-]/g, '_');
  switch (key) {
    case 'bw_film': case 'bw': case 'film': return applyBWFilm(inputBuffer);
    case 'vintage':                          return applyVintage(inputBuffer);
    case 'cyberpunk':                        return applyCyberpunk(inputBuffer);
    case 'warm_glow': case 'warm':           return applyWarmGlow(inputBuffer);
    case 'cool_fade': case 'cool':           return applyCoolFade(inputBuffer);
    case 'high_contrast': case 'contrast':   return applyHighContrast(inputBuffer);
    default:
      console.warn(`[AI] Unknown filter "${filterName}", using B&W Film`);
      return applyBWFilm(inputBuffer);
  }
}

// Drop-in replacement — same signature as old HuggingFace version
async function generateAIImage(buffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.bw_film;
  const filteredBuffer = await applyAIFilter(buffer, styleKey);
  return {
    buffer: filteredBuffer,
    style: style.name,
    styleKey,
    emoji: style.emoji,
  };
}

module.exports = { AI_STYLES, generateAIImage, applyAIFilter };
