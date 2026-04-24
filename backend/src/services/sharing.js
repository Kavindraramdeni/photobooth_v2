const QRCode = require('qrcode');
const sharp  = require('sharp');

/** Generate QR as PNG buffer */
async function generateQRCode(url, options = {}) {
  const { size = 300, color = { dark: '#000000', light: '#ffffff' }, margin = 2 } = options;
  return await QRCode.toBuffer(url, { type: 'png', width: size, margin, color, errorCorrectionLevel: 'H' });
}

/** Generate QR as Data URL for embedding in API responses */
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
 * Build the short share URL for a photo.
 * QR encodes: https://yourapp.com/p/abc123
 * This is short enough for a clean, fast-scanning QR code.
 */
function buildGalleryUrl(eventSlug, photoId = null, shortCode = null) {
  const base = process.env.FRONTEND_URL || 'https://photobooth-v2-ten.vercel.app';
  // If we have a short code, use /p/[code] — short, clean QR
  if (shortCode) return `${base}/p/${shortCode}`;
  // Fallback: /gallery/slug?photo=id
  if (photoId) return `${base}/gallery/${eventSlug}?photo=${photoId}`;
  return `${base}/gallery/${eventSlug}`;
}

/** Generate a unique 6-char alphanumeric short code */
async function generateUniqueShortCode(supabase) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no confusable chars
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const { data } = await supabase.from('photos').select('id').eq('short_code', code).maybeSingle();
    if (!data) return code; // unique
  }
  // Fallback to 8 chars if all 6-char codes tried
  let code = '';
  const chars8 = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (let i = 0; i < 8; i++) code += chars8[Math.floor(Math.random() * chars8.length)];
  return code;
  
}

/** Build WhatsApp share URL */
function buildWhatsAppUrl(photoUrl, eventName = '') {
  const message = encodeURIComponent(`📸 Check out my photo from ${eventName}!\n${photoUrl}`);
  return `https://wa.me/?text=${message}`;
}

/** Build Instagram share data */
function buildInstagramShareData(photoUrl) {
  return { downloadUrl: photoUrl, instructions: 'Download your photo and share it to Instagram!', hashtags: '#photobooth #memories' };
}

module.exports = {
  generateQRCode,
  generateQRDataURL,
  buildGalleryUrl,
  generateUniqueShortCode,
  buildWhatsAppUrl,
  buildInstagramShareData,
};
