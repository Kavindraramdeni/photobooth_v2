/**
 * backend/src/services/webhook.js
 *
 * Fires webhook payload to the event's configured webhookUrl on every photo taken.
 * Called from photos.js route after successful upload.
 *
 * Usage:
 *   const { fireWebhook } = require('../services/webhook');
 *   await fireWebhook(event, photo);   // fire and forget — won't throw
 */

async function fireWebhook(event, photo) {
  const webhookUrl    = event.settings?.webhookUrl;
  const webhookSecret = event.settings?.webhookSecret || '';

  if (!webhookUrl) return; // not configured — skip silently

  const payload = {
    event:      'photo.taken',
    test:       false,
    photoId:    photo.id,
    photoUrl:   photo.url,
    thumbUrl:   photo.thumbUrl || photo.thumb_url || null,
    galleryUrl: photo.galleryUrl || photo.gallery_url || null,
    mode:       photo.mode || 'single',
    eventId:    event.id,
    eventName:  event.name,
    eventSlug:  event.slug,
    timestamp:  new Date().toISOString(),
  };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'SnapBooth/2.0',
  };
  if (webhookSecret) {
    headers['X-SnapBooth-Secret'] = webhookSecret;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`[webhook] fired to ${webhookUrl} for photo ${photo.id}`);
  } catch (err) {
    // Don't let webhook failure break the response to the booth
    console.warn(`[webhook] failed: ${err.message}`);
  }
}

module.exports = { fireWebhook };
