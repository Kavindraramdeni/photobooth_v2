const sharp = require('sharp');

/**
 * Apply branding overlay (text watermark) to an image buffer.
 * @param {Buffer} inputBuffer - JPEG image buffer
 * @param {object} branding - Event branding config { overlayText, primaryColor, eventName }
 * @returns {Promise<Buffer>} - Processed JPEG buffer
 */
async function applyBrandingOverlay(inputBuffer, branding = {}) {
  try {
    const { overlayText, eventName } = branding;
    const text = overlayText || eventName || '';
    if (!text) return inputBuffer;

    const image = sharp(inputBuffer);
    const meta = await image.metadata();
    const width = meta.width || 1024;
    const height = meta.height || 1024;

    const fontSize = Math.max(18, Math.round(width * 0.028));
    const padding = Math.round(fontSize * 0.8);
    const svgText = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="${height - fontSize * 2 - padding}" width="${width}" height="${fontSize * 2 + padding}"
          fill="rgba(0,0,0,0.45)" />
        <text
          x="${width / 2}"
          y="${height - padding / 2}"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          fill="white"
          text-anchor="middle"
          dominant-baseline="middle"
        >${escapeXml(text)}</text>
      </svg>`;

    return await sharp(inputBuffer)
      .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();
  } catch (err) {
    console.warn('applyBrandingOverlay failed, returning original:', err.message);
    return inputBuffer;
  }
}

/**
 * Create a vertical photo strip from multiple image buffers.
 * @param {Buffer[]} photos - Array of image buffers
 * @param {object} branding - Event branding config
 * @returns {Promise<Buffer>} - Combined JPEG strip buffer
 */
async function createPhotoStrip(photos, branding = {}) {
  if (!photos || photos.length === 0) throw new Error('No photos provided for strip');

  const STRIP_WIDTH = 800;
  const GAP = 12;
  const PADDING = 20;

  const resized = await Promise.all(
    photos.map(buf =>
      sharp(buf)
        .resize(STRIP_WIDTH - PADDING * 2, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer()
    )
  );

  const metas = await Promise.all(resized.map(buf => sharp(buf).metadata()));
  const heights = metas.map(m => m.height || 400);
  const totalHeight = heights.reduce((sum, h) => sum + h + GAP, PADDING) + PADDING;

  const composite = [];
  let top = PADDING;
  for (let i = 0; i < resized.length; i++) {
    composite.push({ input: resized[i], top, left: PADDING });
    top += heights[i] + GAP;
  }

  const base = sharp({
    create: {
      width: STRIP_WIDTH,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  let stripBuffer = await base.composite(composite).jpeg({ quality: 92 }).toBuffer();

  if (branding?.eventName || branding?.overlayText) {
    stripBuffer = await applyBrandingOverlay(stripBuffer, branding);
  }

  return stripBuffer;
}

/**
 * Apply basic beauty/skin-smoothing mode using blur + sharpen.
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer>}
 */
async function applyBeautyMode(inputBuffer) {
  try {
    return await sharp(inputBuffer)
      .modulate({ brightness: 1.04, saturation: 0.98 })
      .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.7 })
      .jpeg({ quality: 95 })
      .toBuffer();
  } catch (err) {
    console.warn('applyBeautyMode failed, returning original:', err.message);
    return inputBuffer;
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { applyBrandingOverlay, createPhotoStrip, applyBeautyMode };
