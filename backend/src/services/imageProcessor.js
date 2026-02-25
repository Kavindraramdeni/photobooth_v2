const sharp = require('sharp');

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
    showDate = true,
    template = 'classic', // classic | strip | polaroid
  } = branding;

  const photo = sharp(photoBuffer);
  const metadata = await photo.metadata();
  const { width, height } = metadata;

  const overlays = [];

  // Footer bar overlay
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
  const stripWidth = 640;
  const photoHeight = 480;
  const padding = 20;
  const headerHeight = 80;
  const footerHeight = 80;

  const stripHeight = photoHeight * photos.length + padding * (photos.length + 1) + headerHeight + footerHeight;

  const { primaryColor = '#1a1a2e', eventName = 'SnapBooth', footerText = '' } = branding;

  // Create base canvas
  const svgBase = `
    <svg width="${stripWidth}" height="${stripHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${stripWidth}" height="${stripHeight}" fill="${primaryColor}"/>
      <text 
        x="${stripWidth / 2}" y="${headerHeight / 2 + 10}" 
        text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="32px"
        fill="white" font-weight="bold" letter-spacing="4"
      >${escapeXml(eventName.toUpperCase())}</text>
      <text 
        x="${stripWidth / 2}" y="${stripHeight - footerHeight / 2 + 10}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="18px"
        fill="white" opacity="0.8"
      >${escapeXml(footerText || new Date().toLocaleDateString())}</text>
    </svg>`;

  const compositeInputs = [];

  for (let i = 0; i < photos.length && i < 4; i++) {
    const resized = await sharp(photos[i])
      .resize(stripWidth - padding * 2, photoHeight, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer();

    compositeInputs.push({
      input: resized,
      top: headerHeight + padding + i * (photoHeight + padding),
      left: padding,
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

module.exports = { applyBrandingOverlay, createPhotoStrip, createPolaroid };
