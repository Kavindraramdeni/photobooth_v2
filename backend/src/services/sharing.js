const QRCode = require('qrcode');
const sharp = require('sharp');

/**
 * Generate QR code as buffer
 * @param {string} url - URL to encode
 * @param {Object} options - QR options
 * @returns {Buffer} PNG buffer
 */
async function generateQRCode(url, options = {}) {
  const {
    size = 300,
    color = { dark: '#000000', light: '#ffffff' },
    margin = 2,
  } = options;

  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin,
    color,
    errorCorrectionLevel: 'H',
  });

  return qrBuffer;
}

/**
 * Generate QR code as Data URL (for embedding in responses)
 */
async function generateQRDataURL(url, options = {}) {
  return await QRCode.toDataURL(url, {
    type: 'image/png',
    width: options.size || 300,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: options.color || { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Create a shareable gallery page URL for an event
 */
function buildGalleryUrl(eventSlug, photoId = null) {
  const base = `${process.env.FRONTEND_URL}/gallery/${eventSlug}`;
  return photoId ? `${base}?photo=${photoId}` : base;
}

/**
 * Build WhatsApp share URL
 */
function buildWhatsAppUrl(photoUrl, eventName = '') {
  const message = encodeURIComponent(
    `📸 Check out my photo from ${eventName}!\n${photoUrl}`
  );
  return `https://wa.me/?text=${message}`;
}

/**
 * Build Instagram share instructions (Instagram doesn't support direct share URLs)
 * Returns the download URL and instructions
 */
function buildInstagramShareData(photoUrl) {
  return {
    downloadUrl: photoUrl,
    instructions: 'Download your photo and share it to Instagram!',
    hashtags: '#photobooth #memories',
  };
}

/**
 * Generate QR code with branded styling
 */
async function generateBrandedQR(url, branding = {}) {
  const { primaryColor = '#000000', backgroundColor = '#ffffff', logoBuffer = null } = branding;

  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: primaryColor, light: backgroundColor },
  });

  if (!logoBuffer) return qrBuffer;

  // Add logo in center (30% of QR size)
  const logoSize = 400 * 0.25;
  const logoResized = await sharp(logoBuffer)
    .resize(Math.round(logoSize), Math.round(logoSize), { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const centerOffset = Math.round((400 - logoSize) / 2);

  return await sharp(qrBuffer)
    .composite([{ input: logoResized, top: centerOffset, left: centerOffset }])
    .png()
    .toBuffer();
}

module.exports = {
  generateQRCode,
  generateQRDataURL,
  buildGalleryUrl,
  buildWhatsAppUrl,
  buildInstagramShareData,
  generateBrandedQR,
};
