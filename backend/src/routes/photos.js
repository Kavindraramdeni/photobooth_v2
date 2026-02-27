const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const router = express.Router();

const { uploadToStorage } = require('../services/storage');
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
    console.log('Upload request received');
    console.log('Body:', req.body);
    console.log('File:', req.file ? req.file.size + ' bytes' : 'MISSING');

    var eventId = req.body.eventId;
    var sessionId = req.body.sessionId;
    var photoMode = req.body.mode || 'single';

    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    var eventResult = await supabase.from('events').select('*').eq('id', eventId).single();
    var event = eventResult.data;
    console.log('Event lookup:', event ? event.name : 'NOT FOUND');
    if (!event) return res.status(404).json({ error: 'Event not found' });

    var photoId = uuidv4();
    var timestamp = Date.now();
    var storageKey = 'events/' + eventId + '/photos/' + photoId + '_' + timestamp + '.jpg';

    var processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    try {
      if (event.branding) {
        processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
      }
    } catch (brandingErr) {
      console.error('Branding overlay failed (continuing):', brandingErr.message);
    }

    var photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');
    console.log('Photo uploaded:', photoUrl);

    var thumbBuffer = await sharp(processedBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    var thumbKey = 'events/' + eventId + '/thumbs/' + photoId + '_thumb.jpg';
    var thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    var galleryUrl = buildGalleryUrl(event.slug, photoId);
    var qrDataUrl = await generateQRDataURL(galleryUrl);
    var whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

    var insertResult = await supabase.from('photos').insert({
      id: photoId,
      event_id: eventId,
      session_id: sessionId,
      url: photoUrl,
      thumb_url: thumbUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: photoMode,
      created_at: new Date().toISOString(),
    });
    if (insertResult.error) console.error('DB insert error:', insertResult.error);

    try {
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'photo_taken',
        metadata: { mode: photoMode, photoId: photoId },
      });
    } catch (analyticsErr) {
      console.error('Analytics error:', analyticsErr.message);
    }

    try {
      var io = req.app.get('io');
      if (io) io.to('event-' + eventId).emit('photo-taken', { photoId: photoId, thumbUrl: thumbUrl });
    } catch (socketErr) {
      console.error('Socket error:', socketErr.message);
    }

    return res.json({
      success: true,
      photo: {
        id: photoId,
        url: photoUrl,
        thumbUrl: thumbUrl,
        galleryUrl: galleryUrl,
        qrCode: qrDataUrl,
        whatsappUrl: whatsappUrl,
        downloadUrl: photoUrl,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/photos/gif
router.post('/gif', upload.array('frames', 10), async function(req, res) {
  try {
    var eventId = req.body.eventId;
    var gifType = req.body.type || 'gif';
    var sessionId = req.body.sessionId;

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No frames provided' });

    var eventResult = await supabase.from('events').select('*').eq('id', eventId).single();
    var event = eventResult.data;
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

    return res.json({ success: true, gif: { id: gifId, url: gifUrl, galleryUrl: galleryUrl, qrCode: qrDataUrl, whatsappUrl: whatsappUrl, type: gifType } });
  } catch (error) {
    console.error('GIF error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/photos/strip
router.post('/strip', upload.array('photos', 4), async function(req, res) {
  try {
    var eventId = req.body.eventId;
    var eventResult = await supabase.from('events').select('*').eq('id', eventId).single();
    var event = eventResult.data;
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

    return res.json({ success: true, strip: { id: stripId, url: stripUrl, galleryUrl: galleryUrl, qrCode: qrDataUrl } });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/photos/event/:eventId
router.get('/event/:eventId', async function(req, res) {
  try {
    var eventId = req.params.eventId;
    var page = Number(req.query.page) || 1;
    var limit = Number(req.query.limit) || 50;

    var result = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (result.error) throw result.error;
    return res.json({ photos: result.data || [], page: page, limit: limit });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/photos/:photoId  — MUST BE LAST
router.get('/:photoId', async function(req, res) {
  try {
    var result = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('id', req.params.photoId)
      .single();

    if (result.error || !result.data) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ photo: result.data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
