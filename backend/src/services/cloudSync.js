/**
 * SnapBooth Cloud Auto-Sync Service
 * Supports background auto-sync to Dropbox, Google Drive, and Custom Webhooks
 * (Zapier, Make.com, n8n, and Desktop Watch Folder Agents).
 */

const https = require('https');
const http = require('http');

/**
 * Dispatch cloud auto-sync asynchronously (fire-and-forget, non-blocking)
 * @param {Object} event - Event record containing branding / settings
 * @param {Object} photo - Created photo record { id, url, event_id, mode }
 * @param {Buffer} [imageBuffer] - Optional raw photo buffer for direct upload
 */
async function dispatchCloudAutoSync(event, photo, imageBuffer = null) {
  if (!event || !photo) return;

  const settings = event.settings || {};
  const branding = event.branding || {};

  // 1. Custom Webhook Dispatch (Zapier / Make / n8n / Local Agent)
  const webhookUrl = settings.cloudSyncWebhookUrl || branding.cloudSyncWebhookUrl || process.env.CLOUD_SYNC_WEBHOOK_URL;
  if (webhookUrl) {
    sendWebhookPayload(webhookUrl, {
      event: 'photo.captured',
      eventId: event.id,
      eventName: event.name,
      photoId: photo.id,
      photoUrl: photo.url,
      galleryUrl: photo.gallery_url || photo.url,
      mode: photo.mode || 'single',
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      console.warn('[CloudSync] Webhook dispatch warning:', err.message);
    });
  }

  // 2. Dropbox Direct Folder Sync (Dropbox API v2 /files/upload)
  const dropboxToken = settings.dropboxAccessToken || process.env.DROPBOX_ACCESS_TOKEN;
  if (dropboxToken && (imageBuffer || photo.url)) {
    uploadToDropbox(dropboxToken, event.name, photo, imageBuffer).catch((err) => {
      console.warn('[CloudSync] Dropbox upload warning:', err.message);
    });
  }

  // 3. Google Drive Auto-Sync Webhook / Integration
  const googleDriveWebhook = settings.googleDriveWebhookUrl || process.env.GOOGLE_DRIVE_WEBHOOK_URL;
  if (googleDriveWebhook) {
    sendWebhookPayload(googleDriveWebhook, {
      event: 'photo.sync.gdrive',
      folderId: settings.googleDriveFolderId || null,
      eventId: event.id,
      eventName: event.name,
      photoId: photo.id,
      photoUrl: photo.url,
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      console.warn('[CloudSync] Google Drive webhook warning:', err.message);
    });
  }
}

/**
 * Send JSON payload to a remote webhook
 */
function sendWebhookPayload(urlStr, payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const data = JSON.stringify(payload);
      const mod = url.protocol === 'https:' ? https : http;

      const req = mod.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'User-Agent': 'SnapBooth-CloudSync/2.0',
          },
          timeout: 8000,
        },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, status: res.statusCode });
          }
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, timeout: true });
      });
      req.write(data);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Upload directly to Dropbox /SnapBooth/{EventName}/{photoId}.jpg
 */
async function uploadToDropbox(accessToken, eventName, photo, imageBuffer) {
  let buffer = imageBuffer;
  if (!buffer && photo.url) {
    buffer = await fetchBufferFromUrl(photo.url);
  }
  if (!buffer || buffer.length === 0) return;

  const safeEventName = (eventName || 'General').replace(/[/\\?%*:|"<>]/g, '_');
  const path = `/SnapBooth/${safeEventName}/${photo.id}.jpg`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://content.dropboxapi.com/2/files/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path,
            mode: 'add',
            autorename: true,
            mute: false,
            strict_conflict: false,
          }),
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length,
        },
        timeout: 15000,
      },
      (res) => {
        let responseData = '';
        res.on('data', (c) => (responseData += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`[CloudSync] Synced photo ${photo.id} to Dropbox at ${path}`);
            resolve({ ok: true, path });
          } else {
            console.warn(`[CloudSync] Dropbox error (${res.statusCode}):`, responseData);
            resolve({ ok: false, status: res.statusCode });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/**
 * Download a remote image into a buffer safely
 */
function fetchBufferFromUrl(urlStr) {
  return new Promise((resolve, reject) => {
    if (urlStr.startsWith('data:')) {
      const clean = urlStr.replace(/^data:image\/\w+;base64,/, '');
      return resolve(Buffer.from(clean, 'base64'));
    }
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  dispatchCloudAutoSync,
};
