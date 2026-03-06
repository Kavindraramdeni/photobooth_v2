/**
 * backend/src/services/sharing.js  (FULL REPLACEMENT)
 *
 * Changes:
 *   - buildGalleryUrl now returns /gallery/[photoId] (per-photo, not event gallery)
 *   - Added generateShortCode() for /p/[6char] short URLs
 *   - Short URL resolves to /gallery/[photoId] server-side
 */

const QRCode = require('qrcode');
const sharp  = require('sharp');

// ─── URL builders ─────────────────────────────────────────────────────────────

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app').replace(/\/$/, '');
}

/**
 * Per-photo gallery URL — unique to this guest's photo.
 * Format: /gallery/[photoId]
 * If photo has a short_code, returns /p/[short_code] instead (shorter = better QR)
 */
function buildGalleryUrl(eventSlug, photoId, shortCode = null) {
  if (shortCode) return `${frontendUrl()}/p/${shortCode}`;
  return `${frontendUrl()}/gallery/${photoId}`;
}

/**
 * Generate a 6-character alphanumeric short code.
 * Collision-safe: caller should check uniqueness in DB before using.
 */
function generateShortCode(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/O/1/l confusion
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a unique short code — retries up to 5 times if collision.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function generateUniqueShortCode(supabase, length = 6) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode(length);
    const { data } = await supabase
      .from('photos')
      .select('id')
      .eq('short_code', code)
      .maybeSingle();
    if (!data) return code; // no collision
  }
  // Fallback: use 8 chars if 6-char space exhausted
  return generateShortCode(8);
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

function buildWhatsAppUrl(photoUrl, eventName = '') {
  const message = encodeURIComponent(
    `📸 My photo from ${eventName}!\n${photoUrl}`
  );
  return `https://wa.me/?text=${message}`;
}

// ─── QR Code generators ───────────────────────────────────────────────────────

async function generateQRCode(url, options = {}) {
  const {
    size = 300,
    color = { dark: '#000000', light: '#ffffff' },
    margin = 2,
  } = options;

  return await QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin,
    color,
    errorCorrectionLevel: 'H',
  });
}

async function generateQRDataURL(url, options = {}) {
  // Always black QR — brand colours reduce scan reliability
  return await QRCode.toDataURL(url, {
    type: 'image/png',
    width: options.size || 300,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Generate QR code with optional logo overlay in center.
 */
async function generateBrandedQR(url, branding = {}) {
  const { logoBuffer = null } = branding;

  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' }, // always B&W for scannability
  });

  if (!logoBuffer) return qrBuffer;

  const logoSize = Math.round(400 * 0.25);
  const logoResized = await sharp(logoBuffer)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const centerOffset = Math.round((400 - logoSize) / 2);

  return await sharp(qrBuffer)
    .composite([{ input: logoResized, top: centerOffset, left: centerOffset }])
    .png()
    .toBuffer();
}

// ─── Instagram Stories ────────────────────────────────────────────────────────

/**
 * Generate a 9:16 Instagram Stories crop with event branding.
 * Returns a PNG buffer ready for download/share.
 *
 * @param {Buffer} photoBuffer  original photo
 * @param {Object} branding     { eventName, logoBuffer, primaryColor }
 */
async function generateStoriesImage(photoBuffer, branding = {}) {
  const { eventName = 'SnapBooth', primaryColor = '#7c3aed' } = branding;

  const STORIES_W = 1080;
  const STORIES_H = 1920;

  // Resize photo to fit inside 1080×1440 (leaving 480px at bottom for branding)
  const photoResized = await sharp(photoBuffer)
    .resize(STORIES_W, 1440, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  const photoMeta = await sharp(photoResized).metadata();
  const photoTop  = Math.round((1440 - (photoMeta.height || 1440)) / 2);
  const photoLeft = Math.round((STORIES_W - (photoMeta.width || STORIES_W)) / 2);

  // Parse hex colour to RGB
  const hex = primaryColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create base canvas: gradient from dark top to branded bottom
  const base = await sharp({
    create: {
      width: STORIES_W,
      height: STORIES_H,
      channels: 4,
      background: { r: 10, g: 10, b: 15, alpha: 1 },
    },
  })
  .png()
  .toBuffer();

  // Bottom branding strip (SVG overlay)
  const brandingSVG = Buffer.from(`
<svg width="${STORIES_W}" height="480" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(10,10,15)" stop-opacity="0"/>
      <stop offset="40%" stop-color="rgb(${r},${g},${b})" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="rgb(${r},${g},${b})" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="${STORIES_W}" height="480" fill="url(#bg)"/>
  <text x="${STORIES_W / 2}" y="280"
    font-family="Arial Black, Arial, sans-serif"
    font-size="72" font-weight="900"
    fill="white" text-anchor="middle"
    opacity="0.95">
    ${eventName.length > 20 ? eventName.substring(0, 20) + '…' : eventName}
  </text>
  <text x="${STORIES_W / 2}" y="360"
    font-family="Arial, sans-serif"
    font-size="40" fill="rgba(255,255,255,0.6)"
    text-anchor="middle">
    📸 SnapBooth AI
  </text>
</svg>`);

  const result = await sharp(base)
    .composite([
      // Photo centered in top 1440px
      { input: photoResized, top: photoTop, left: photoLeft },
      // Branding strip at bottom
      { input: brandingSVG, top: STORIES_H - 480, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return result;
}

module.exports = {
  generateQRCode,
  generateQRDataURL,
  generateBrandedQR,
  buildGalleryUrl,
  buildWhatsAppUrl,
  generateShortCode,
  generateUniqueShortCode,
  generateStoriesImage,
};
