let sharp;
try { sharp = require('sharp'); } catch(e) { console.error('[service] sharp load failed:', e.message); }
// Note: all image compositing uses sharp + inline SVG strings, no canvas package needed

/**
 * Apply event branding overlay to an image
 * @param {Buffer} photoBuffer - Original photo
 * @param {Object} branding - Event branding config from DB
 * @returns {Buffer} Branded image buffer
 */
async function applyBrandingOverlay(photoBuffer, branding = {}) {
  const {
    overlayText = '',
    logoUrl = null,
    primaryColor = '#ffffff',
    secondaryColor = '#000000',
    footerText = '',
    eventName = 'SnapBooth',
    showDate = true,
    template = 'classic', // classic | strip | polaroid
  } = branding;

  const photo = sharp(photoBuffer);
  const metadata = await photo.metadata();
  const { width, height } = metadata;

  const overlays = [];

  // ── Polaroid template: add white border + caption ─────────────────────────
  if (template === 'polaroid') {
    const borderSide = Math.round(width * 0.05);
    const borderBottom = Math.round(width * 0.18);
    const captionText = footerText || eventName || 'SnapBooth';
    const newWidth = width + borderSide * 2;
    const newHeight = height + borderSide + borderBottom;

    const svgPolaroid = `<svg width="${newWidth}" height="${newHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${newWidth}" height="${newHeight}" fill="white" rx="4"/>
      <rect x="1" y="1" width="${newWidth - 2}" height="${newHeight - 2}" fill="none" stroke="#ddd" stroke-width="1" rx="4"/>
      <text x="${newWidth / 2}" y="${height + borderSide + borderBottom * 0.6}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="'Courier New', monospace" font-size="${Math.round(borderBottom * 0.28)}px"
        fill="#333">${escapeXml(captionText)}</text>
    </svg>`;

    // Place original photo on polaroid background
    const base = await sharp(Buffer.from(svgPolaroid))
      .composite([{ input: photoBuffer, top: borderSide, left: borderSide }])
      .jpeg({ quality: 95 })
      .toBuffer();
    return base;
  }

  // Footer bar overlay (classic template)
  if (footerText || showDate) {
    const footerHeight = Math.round(height * 0.08);
    const dateStr = showDate ? new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    }) : '';
    const displayText = footerText || dateStr;

    const svgFooter = `
      <svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${footerHeight}" fill="${primaryColor}" opacity="0.88"/>
        <text 
          x="${width / 2}" 
          y="${footerHeight * 0.65}" 
          text-anchor="middle" 
          dominant-baseline="middle"
          font-family="Arial, sans-serif" 
          font-size="${Math.round(footerHeight * 0.45)}px"
          fill="${secondaryColor}"
          font-weight="bold"
        >${escapeXml(displayText)}</text>
        ${dateStr && footerText ? `
        <text 
          x="${width / 2}" 
          y="${footerHeight * 0.85}" 
          text-anchor="middle"
          font-family="Arial, sans-serif" 
          font-size="${Math.round(footerHeight * 0.28)}px"
          fill="${secondaryColor}"
          opacity="0.75"
        >${escapeXml(dateStr)}</text>` : ''}
      </svg>`;

    overlays.push({
      input: Buffer.from(svgFooter),
      top: height - footerHeight,
      left: 0,
    });
  }

  // Watermark / event name overlay (top left)
  if (overlayText) {
    const svgWatermark = `
      <svg width="${width}" height="60" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="60" fill="black" opacity="0.3"/>
        <text 
          x="20" y="38" 
          font-family="Arial, sans-serif" 
          font-size="24px"
          fill="white"
          font-weight="bold"
          opacity="0.9"
        >${escapeXml(overlayText)}</text>
      </svg>`;
    overlays.push({ input: Buffer.from(svgWatermark), top: 0, left: 0 });
  }

  if (overlays.length === 0) return photoBuffer;

  return await photo.composite(overlays).jpeg({ quality: 96 }).toBuffer();
}

/**
 * Create a photo strip (4 photos in vertical strip, classic photobooth style)
 * @param {Buffer[]} photos - Array of 4 photo buffers
 * @param {Object} branding - Branding config
 */
async function createPhotoStrip(photos, branding = {}) {
  // Classic photobooth strip — narrow portrait format (2x6 inch at 300dpi = 600x1800px)
  // Photos are square-ish, 4 stacked vertically with thin gaps and header/footer
  const stripWidth  = 600;   // ~2 inches at 300dpi
  const photoWidth  = 560;   // photo width (20px margin each side)
  const photoHeight = 420;   // 4:3 aspect per photo
  const padding     = 12;    // gap between photos
  const margin      = 20;    // left/right margin
  const headerHeight = 70;
  const footerHeight = 60;

  const totalPhotoArea = photoHeight * 4 + padding * 3;
  const stripHeight = headerHeight + padding + totalPhotoArea + padding + footerHeight;

  const { primaryColor = '#1a1a2e', eventName = 'SnapBooth', footerText = '' } = branding;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const svgBase = `<svg width="${stripWidth}" height="${stripHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${primaryColor}dd"/>
      </linearGradient>
    </defs>
    <rect width="${stripWidth}" height="${stripHeight}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${stripWidth}" height="${headerHeight}" fill="rgba(0,0,0,0.25)"/>
    <text x="${stripWidth/2}" y="${headerHeight/2}" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, sans-serif" font-size="26px" fill="white" font-weight="900"
      letter-spacing="3">${escapeXml(eventName.toUpperCase())}</text>
    <rect x="0" y="${stripHeight - footerHeight}" width="${stripWidth}" height="${footerHeight}" fill="rgba(0,0,0,0.25)"/>
    <text x="${stripWidth/2}" y="${stripHeight - footerHeight/2}" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, sans-serif" font-size="16px" fill="rgba(255,255,255,0.85)">
      ${escapeXml(footerText || dateStr)}
    </text>
  </svg>`;

  const compositeInputs = [];

  for (let i = 0; i < Math.min(photos.length, 4); i++) {
    const resized = await sharp(photos[i])
      .resize(photoWidth, photoHeight, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 92 })
      .toBuffer();

    compositeInputs.push({
      input: resized,
      top: headerHeight + padding + i * (photoHeight + padding),
      left: margin,
    });
  }

  // If fewer than 4 photos, fill remaining slots with a dark placeholder
  for (let i = photos.length; i < 4; i++) {
    const placeholderSvg = `<svg width="${photoWidth}" height="${photoHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${photoWidth}" height="${photoHeight}" fill="rgba(0,0,0,0.3)"/>
      <text x="${photoWidth/2}" y="${photoHeight/2}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial" font-size="18px" fill="rgba(255,255,255,0.3)">📸</text>
    </svg>`;
    compositeInputs.push({
      input: Buffer.from(placeholderSvg),
      top: headerHeight + padding + i * (photoHeight + padding),
      left: margin,
    });
  }

  return await sharp(Buffer.from(svgBase))
    .composite(compositeInputs)
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Create a polaroid-style single photo
 */
async function createPolaroid(photoBuffer, caption = '', branding = {}) {
  const photoWidth = 800;
  const photoHeight = 600;
  const borderSize = 20;
  const bottomBorder = 100;

  const polaroidWidth = photoWidth + borderSize * 2;
  const polaroidHeight = photoHeight + borderSize + bottomBorder;

  const resizedPhoto = await sharp(photoBuffer)
    .resize(photoWidth, photoHeight, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const svgFrame = `
    <svg width="${polaroidWidth}" height="${polaroidHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${polaroidWidth}" height="${polaroidHeight}" fill="white" rx="4"/>
      <rect x="1" y="1" width="${polaroidWidth - 2}" height="${polaroidHeight - 2}" 
            fill="none" stroke="#e0e0e0" stroke-width="1" rx="4"/>
      <text 
        x="${polaroidWidth / 2}" y="${photoHeight + borderSize + 55}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="'Courier New', monospace" font-size="22px"
        fill="#333"
      >${escapeXml(caption)}</text>
    </svg>`;

  return await sharp(Buffer.from(svgFrame))
    .composite([{ input: resizedPhoto, top: borderSize, left: borderSize }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


/**
 * Apply beauty mode — skin smoothing using blur+sharpen pipeline
 * @param {Buffer} photoBuffer 
 * @param {number} level — 0 to 10 (default 5)
 */
async function applyBeautyMode(photoBuffer, level = 5) {
  if (!sharp || level === 0) return photoBuffer;
  const strength = Math.min(10, Math.max(0, level));
  const blurSigma = 0.3 + (strength / 10) * 1.2;  // 0.3 – 1.5
  const sharpSigma = 0.5 + (strength / 10) * 0.8;  // 0.5 – 1.3
  // Slight brightness boost + soft blur + sharpen edges = skin smoothing effect
  return await sharp(photoBuffer)
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .blur(blurSigma)
    .sharpen({ sigma: sharpSigma, m1: 0.3, m2: 0.1 })
    .jpeg({ quality: 94 })
    .toBuffer();
}

module.exports = { applyBrandingOverlay, createPhotoStrip, createPolaroid, applyBeautyMode };
