const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const archiver = require('archiver');
const https = require('https');
const http = require('http');
const router = express.Router();

const { uploadToStorage, deleteFromStorage } = require('../services/storage');
const { applyBrandingOverlay, createPhotoStrip } = require('../services/imageProcessor');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl } = require('../services/sharing');
const { createGIF, createBoomerang } = require('../services/gif');
const supabase = require('../services/database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// POST /api/photos/upload
router.post('/upload', upload.single('photo'), async function(req, res) {
  try {
    var eventId = req.body.eventId;
    var sessionId = req.body.sessionId;
    var photoMode = req.body.mode || 'single';

    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    var eventResult = await supabase.from('events').select('*').eq('id', eventId).single();
    var event = eventResult.data;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    var photoId = uuidv4();
    var timestamp = Date.now();
    var storageKey = 'events/' + eventId + '/photos/' + photoId + '_' + timestamp + '.jpg';

    var processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    // Only apply branding overlay if branding has actual visible content
    try {
      if (event.branding && hasBrandingContent(event.branding)) {
        processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
      }
    } catch (e) { console.error('Branding overlay failed:', e.message); }

    var photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');

    var thumbBuffer = await sharp(processedBuffer).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    var thumbKey = 'events/' + eventId + '/thumbs/' + photoId + '_thumb.jpg';
    var thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    var galleryUrl = buildGalleryUrl(event.slug, photoId);
    var qrDataUrl = await generateQRDataURL(galleryUrl);
    var whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

    var insertResult = await supabase.from('photos').insert({
      id: photoId, event_id: eventId, session_id: sessionId,
      url: photoUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, mode: photoMode, created_at: new Date().toISOString(),
    });
    if (insertResult.error) console.error('DB insert error:', insertResult.error);

    try {
      await supabase.from('analytics').insert({
        event_id: eventId, action: 'photo_taken', metadata: { mode: photoMode, photoId: photoId },
      });
    } catch (e) {}

    try {
      var io = req.app.get('io');
      if (io) io.to('event-' + eventId).emit('photo-taken', {
        photoId: photoId, thumbUrl: thumbUrl, galleryUrl: galleryUrl,
        mode: photoMode, timestamp: new Date().toISOString(),
      });
    } catch (e) {}

    res.json({ success: true, photo: {
      id: photoId, url: photoUrl, thumbUrl: thumbUrl, galleryUrl: galleryUrl,
      qrCode: qrDataUrl, whatsappUrl: whatsappUrl, downloadUrl: photoUrl,
    }});
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/photos/gif
router.post('/gif', upload.array('frames', 10), async function(req, res) {
  try {
    var eventId = req.body.eventId;
    var gifType = req.body.type || 'gif';
    var sessionId = req.body.sessionId;
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No frames provided' });

    var event = (await supabase.from('events').select('*').eq('id', eventId).single()).data;
    var frames = req.files.map(function(f) { return f.buffer; });
    var gifBuffer = gifType === 'boomerang' ? await createBoomerang(frames) : await createGIF(frames);
    var gifId = uuidv4();
    var storageKey = 'events/' + eventId + '/gifs/' + gifId + '.gif';
    var gifUrl = await uploadToStorage(gifBuffer, storageKey, 'image/gif');
    var galleryUrl = buildGalleryUrl(event ? event.slug : eventId, gifId);
    var qrDataUrl = await generateQRDataURL(galleryUrl);
    var whatsappUrl = buildWhatsAppUrl(gifUrl, event ? event.name : '');

    await supabase.from('photos').insert({
      id: gifId, event_id: eventId, session_id: sessionId,
      url: gifUrl, gallery_url: galleryUrl, storage_key: storageKey, mode: gifType,
    });
    try { await supabase.from('analytics').insert({ event_id: eventId, action: gifType === 'boomerang' ? 'boomerang_created' : 'gif_created', metadata: {} }); } catch(e){}

    res.json({ success: true, gif: { id: gifId, url: gifUrl, galleryUrl: galleryUrl, qrCode: qrDataUrl, whatsappUrl: whatsappUrl, type: gifType }});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/photos/strip
router.post('/strip', upload.array('photos', 4), async function(req, res) {
  try {
    var eventId = req.body.eventId;
    var event = (await supabase.from('events').select('*').eq('id', eventId).single()).data;
    var photos = req.files.map(function(f) { return f.buffer; });
    var stripBuffer = await createPhotoStrip(photos, event ? event.branding : {});
    var stripId = uuidv4();
    var storageKey = 'events/' + eventId + '/strips/' + stripId + '.jpg';
    var stripUrl = await uploadToStorage(stripBuffer, storageKey, 'image/jpeg');
    var galleryUrl = buildGalleryUrl(event ? event.slug : eventId, stripId);
    var qrDataUrl = await generateQRDataURL(galleryUrl);
    await supabase.from('photos').insert({
      id: stripId, event_id: eventId, url: stripUrl,
      gallery_url: galleryUrl, storage_key: storageKey, mode: 'strip',
    });
    res.json({ success: true, strip: { id: stripId, url: stripUrl, galleryUrl: galleryUrl, qrCode: qrDataUrl }});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/photos/event/:eventId/zip
router.get('/event/:eventId/zip', async function(req, res) {
  try {
    var eventId = req.params.eventId;
    var photosResult = await supabase
      .from('photos').select('id, url, mode, created_at')
      .eq('event_id', eventId).order('created_at', { ascending: false });
    var photos = photosResult.data || [];
    if (!photos.length) return res.status(404).json({ error: 'No photos found' });

    var event = (await supabase.from('events').select('name').eq('id', eventId).single()).data;
    var eventName = (event ? event.name : 'event').replace(/[^a-z0-9]/gi, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + eventName + '_photos.zip"');

    var archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);
    archive.on('error', function(err) { console.error('Archive error:', err); });

    var skipped = 0;
    for (var i = 0; i < photos.length; i++) {
      var photo = photos[i];
      try {
        var buf = await fetchBuffer(photo.url);
        var ext = (photo.mode === 'gif' || photo.mode === 'boomerang') ? 'gif' : 'jpg';
        archive.append(buf, { name: photo.mode + '_' + (i + 1) + '_' + photo.id.slice(0, 8) + '.' + ext });
      } catch (e) {
        skipped++;
        console.error('[ZIP] Skipping photo ' + photo.id + ': ' + e.message);
      }
    }

    if (skipped > 0) {
      console.warn('[ZIP] Skipped ' + skipped + '/' + photos.length + ' photos due to fetch errors');
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// GET /api/photos/event/:eventId
router.get('/event/:eventId', async function(req, res) {
  try {
    var eventId = req.params.eventId;
    var page = Number(req.query.page) || 1;
    var limit = Number(req.query.limit) || 50;
    var result = await supabase
      .from('photos').select('id, url, thumb_url, gallery_url, mode, created_at, storage_key')
      .eq('event_id', eventId).order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (result.error) throw result.error;
    res.json({ photos: result.data || [], page: page, limit: limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/photos/:photoId
router.delete('/:photoId', async function(req, res) {
  try {
    var photoId = req.params.photoId;
    var photoResult = await supabase.from('photos').select('id, storage_key, event_id').eq('id', photoId).single();
    var photo = photoResult.data;
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    if (photo.storage_key) {
      try { await deleteFromStorage(photo.storage_key); } catch(e){}
      try {
        var thumbKey = photo.storage_key.replace('/photos/', '/thumbs/').replace(/\.jpg$/, '_thumb.jpg');
        await deleteFromStorage(thumbKey);
      } catch(e){}
    }

    await supabase.from('photos').delete().eq('id', photoId);

    try {
      var io = req.app.get('io');
      if (io && photo.event_id) io.to('event-' + photo.event_id).emit('photo-deleted', { photoId: photoId });
    } catch(e){}

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/photos/:photoId — MUST BE LAST
router.get('/:photoId', async function(req, res) {
  try {
    var result = await supabase.from('photos').select('*, events(name, branding)').eq('id', req.params.photoId).single();
    if (result.error || !result.data) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true only when branding has visible content to stamp on photos.
 * footerText and overlayText must be non-empty strings.
 * showDate must be explicitly true.
 * This makes branding opt-in — clean photos by default.
 */
function hasBrandingContent(branding) {
  if (!branding) return false;
  var hasFooter = !!(branding.footerText && branding.footerText.trim());
  var hasOverlay = !!(branding.overlayText && branding.overlayText.trim());
  var hasDate = branding.showDate === true;
  return hasFooter || hasOverlay || hasDate;
}

/**
 * Fetch a remote URL into a Buffer with hardened error handling.
 *
 * Fixes over the original downloadBuffer:
 *   - Rejects non-2xx HTTP responses (404 HTML would corrupt ZIP entries)
 *   - Rejects unexpected content-types (text/html etc.)
 *   - Follows up to 3 redirects
 *   - 10s connection timeout via socket.setTimeout
 *   - 30s total response-body timeout to prevent stalled downloads
 */
function fetchBuffer(url, options) {
  options = options || {};
  var maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 3;
  var connectTimeoutMs = options.connectTimeoutMs || 10000;
  var responseTimeoutMs = options.responseTimeoutMs || 30000;

  return new Promise(function(resolve, reject) {
    var client = url.startsWith('https') ? https : http;

    var req = client.get(url, function(resp) {
      // Follow redirects
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && maxRedirects > 0) {
        resp.resume();
        return fetchBuffer(resp.headers.location, {
          maxRedirects: maxRedirects - 1,
          connectTimeoutMs: connectTimeoutMs,
          responseTimeoutMs: responseTimeoutMs,
        }).then(resolve, reject);
      }

      // Reject non-2xx — prevents 404 HTML pages being added to ZIP
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        resp.resume();
        return reject(new Error('HTTP ' + resp.statusCode + ' for ' + url));
      }

      // Reject HTML content — storage CDNs return HTML error pages on missing keys
      var contentType = resp.headers['content-type'] || '';
      if (contentType.startsWith('text/') || contentType.includes('html')) {
        resp.resume();
        return reject(new Error('Unexpected content-type "' + contentType + '" for ' + url));
      }

      // Response-body stall timeout
      var responseTimer = setTimeout(function() {
        req.destroy();
        reject(new Error('Response timeout for ' + url));
      }, responseTimeoutMs);

      var chunks = [];
      resp.on('data', function(c) { chunks.push(c); });
      resp.on('end', function() {
        clearTimeout(responseTimer);
        resolve(Buffer.concat(chunks));
      });
      resp.on('error', function(err) {
        clearTimeout(responseTimer);
        reject(err);
      });
    });

    // Connection timeout
    req.setTimeout(connectTimeoutMs, function() {
      req.destroy();
      reject(new Error('Connection timeout for ' + url));
    });

    req.on('error', reject);
  });
}

module.exports = router;
module.exports.fetchBuffer = fetchBuffer;
module.exports.hasBrandingContent = hasBrandingContent;
