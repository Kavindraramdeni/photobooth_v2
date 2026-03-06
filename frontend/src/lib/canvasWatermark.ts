/**
 * canvasWatermark.ts
 * Client-side watermark via Canvas API — zero backend, zero dependencies.
 * Called right before uploadPhoto() to stamp the event logo/text on the image.
 *
 * Usage:
 *   import { applyCanvasWatermark } from '@/lib/canvasWatermark';
 *   const watermarked = await applyCanvasWatermark(originalBlob, event.branding);
 *   await uploadPhoto(watermarked, eventId, sessionId);
 *
 * Falls back to original blob on any error — never blocks the upload.
 */

export interface WatermarkConfig {
  logoUrl?:      string | null;   // event logo image URL
  overlayText?:  string;          // text watermark, e.g. "#EventHashtag"
  footerText?:   string;          // footer bar text
  primaryColor?: string;          // footer background colour
  eventName?:    string;
  showDate?:     boolean;
}

/**
 * Load an image from a URL into an HTMLImageElement, CORS-safe.
 * Returns null on failure (broken URL, CORS error, timeout).
 */
async function loadImage(url: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { img.src = ''; resolve(null); }, timeoutMs);
    img.onload  = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

/**
 * Convert a Blob to an ImageBitmap for drawing on canvas.
 */
async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'undefined') {
    return createImageBitmap(blob);
  }
  // Fallback: objectURL → HTMLImageElement → ImageBitmap
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(createImageBitmap(img) as unknown as ImageBitmap); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

/**
 * Apply watermark to a photo blob.
 * Returns a new Blob with the watermark composited on top.
 * On any failure returns the original blob unchanged.
 */
export async function applyCanvasWatermark(
  photoBlob: Blob,
  config: WatermarkConfig,
  quality = 0.92,
): Promise<Blob> {
  // Nothing to do?
  const hasLogo   = !!config.logoUrl;
  const hasText   = !!(config.overlayText || config.footerText || config.eventName);
  if (!hasLogo && !hasText) return photoBlob;

  try {
    // 1. Draw photo onto canvas
    const bitmap = await blobToImageBitmap(photoBlob);
    const canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return photoBlob;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const W = canvas.width;
    const H = canvas.height;

    // 2. Footer bar (if footerText or eventName or showDate)
    const footerContent = [
      config.footerText || config.eventName || '',
      config.showDate ? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
    ].filter(Boolean).join('  ·  ');

    if (footerContent) {
      const barH = Math.round(H * 0.055); // ~5.5% of image height
      const fontSize = Math.round(barH * 0.52);

      ctx.fillStyle = config.primaryColor || '#1a1a2e';
      ctx.fillRect(0, H - barH, W, barH);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerContent, W / 2, H - barH / 2, W * 0.9);
    }

    // 3. Overlay text (top-left hashtag / watermark)
    if (config.overlayText) {
      const fontSize = Math.round(H * 0.028);
      const pad      = Math.round(H * 0.018);

      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // Shadow for legibility on any background
      ctx.shadowColor   = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur    = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(config.overlayText, pad, pad);

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;
    }

    // 4. Logo (bottom-right corner)
    if (config.logoUrl) {
      const logoImg = await loadImage(config.logoUrl);
      if (logoImg) {
        const maxLogoH = Math.round(H * 0.10);  // max 10% of photo height
        const ratio    = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoH    = Math.min(maxLogoH, logoImg.naturalHeight);
        const logoW    = logoH * ratio;
        const pad      = Math.round(H * 0.02);

        const footerBarH = footerContent ? Math.round(H * 0.055) : 0;
        const logoX = W - logoW - pad;
        const logoY = H - logoH - pad - footerBarH;

        // Semi-transparent backing for logo legibility
        ctx.globalAlpha = 0.85;
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        ctx.globalAlpha = 1.0;
      }
    }

    // 5. Export back to Blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
        'image/jpeg',
        quality,
      );
    });
  } catch (err) {
    console.warn('[canvasWatermark] failed, using original:', err);
    return photoBlob; // never block the upload
  }
}
