const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp   = require('sharp');
const router  = express.Router();

const { uploadToStorage, deleteFromStorage } = require('../services/storage');
const { applyBrandingOverlay, createPhotoStrip, createPolaroid } = require('../services/imageProcessor');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl, generateUniqueShortCode } = require('../services/sharing');
const { createGIF, createBoomerang } = require('../services/gif');
const supabase = require('../services/database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ─── POST /api/photos/upload ──────────────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { eventId, mode = 'single', sessionId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId)  return res.status(400).json({ error: 'Event ID required' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const photoId    = uuidv4();
    const storageKey = `events/${eventId}/photos/${photoId}_${Date.now()}.jpg`;

    let processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    if (event.branding) {
      const template = event.branding.template || 'classic';
      if (template === 'polaroid') {
        const caption = event.branding.footerText || event.branding.eventName || '';
        processedBuffer = await createPolaroid(processedBuffer, caption, event.branding);
      } else {
        processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
      }
    }

    const photoUrl   = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');
    const thumbBuffer = await sharp(processedBuffer).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    const thumbUrl   = await uploadToStorage(thumbBuffer, `events/${eventId}/thumbs/${photoId}_thumb.jpg`, 'image/jpeg');

    // Generate short code → /p/abc123 QR URL
    const shortCode  = await generateUniqueShortCode(supabase);
    const galleryUrl = buildGalleryUrl(event.slug, photoId, shortCode);
    const qrDataUrl  = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(galleryUrl, event.name);

    await supabase.from('photos').insert({
      id: photoId, event_id: eventId, session_id: sessionId,
      url: photoUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, short_code: shortCode, mode,
      created_at: new Date().toISOString(),
    });

    supabase.from('analytics').insert({ event_id: eventId, action: 'photo_taken', metadata: { mode, photoId } }).catch(() => {});

    const io = req.app.get('io');
    if (io) io.to(`event-${eventId}`).emit('photo-taken', { photoId, thumbUrl, galleryUrl, mode, timestamp: new Date().toISOString() });

    res.json({ success: true, photo: { id: photoId, url: photoUrl, thumbUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, downloadUrl: photoUrl } });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/photos/gif ─────────────────────────────────────────────────────
router.post('/gif', upload.array('frames', 10), async (req, res) => {
  try {
    const { eventId, type = 'gif', sessionId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const frames = req.files.map(f => f.buffer);
    const gifBuffer = type === 'boomerang' ? await createBoomerang(frames) : await createGIF(frames);

    const gifId      = uuidv4();
    const storageKey = `events/${eventId}/gifs/${gifId}.gif`;
    const gifUrl     = await uploadToStorage(gifBuffer, storageKey, 'image/gif');

    const shortCode  = await generateUniqueShortCode(supabase);
    const galleryUrl = buildGalleryUrl(event?.slug || eventId, gifId, shortCode);
    const qrDataUrl  = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(galleryUrl, event?.name);

    await supabase.from('photos').insert({
      id: gifId, event_id: eventId, session_id: sessionId,
      url: gifUrl, gallery_url: galleryUrl, storage_key: storageKey,
      short_code: shortCode, mode: type,
    });

    supabase.from('analytics').insert({ event_id: eventId, action: type === 'boomerang' ? 'boomerang_created' : 'gif_created', metadata: { frameCount: frames.length } }).catch(() => {});

    res.json({ success: true, gif: { id: gifId, url: gifUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, type } });
  } catch (error) {
    console.error('GIF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/photos/strip ───────────────────────────────────────────────────
router.post('/strip', upload.array('photos', 4), async (req, res) => {
  try {
    const { eventId } = req.body;
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const photos = req.files.map(f => f.buffer);
    const stripBuffer = await createPhotoStrip(photos, event?.branding || {});

    const stripId    = uuidv4();
    const storageKey = `events/${eventId}/strips/${stripId}.jpg`;
    const stripUrl   = await uploadToStorage(stripBuffer, storageKey, 'image/jpeg');

    const shortCode  = await generateUniqueShortCode(supabase);
    const galleryUrl = buildGalleryUrl(event?.slug || eventId, stripId, shortCode);
    const qrDataUrl  = await generateQRDataURL(galleryUrl);

    await supabase.from('photos').insert({
      id: stripId, event_id: eventId, url: stripUrl, thumb_url: stripUrl,
      gallery_url: galleryUrl, short_code: shortCode, mode: 'strip',
      session_id: req.body.sessionId || null,
    });

    res.json({ success: true, strip: { id: stripId, url: stripUrl, galleryUrl, qrCode: qrDataUrl } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/photos/short/:code ─────────────────────────────────────────────
// Called by /p/[code] frontend page to resolve short URL → photo
router.get('/short/:code', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug, branding)')
      .eq('short_code', req.params.code)
      .maybeSingle();
    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/photos/event/:eventId ──────────────────────────────────────────
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page  = Number(req.query.page) || 1;

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, short_code, mode, created_at, is_hidden')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;
    res.json({ photos, page, limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE /api/photos/:photoId ─────────────────────────────────────────────
router.delete('/:photoId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('id, storage_key')
      .eq('id', req.params.photoId)
      .single();

    if (fetchErr || !photo) return res.status(404).json({ error: 'Photo not found' });

    // Delete from storage if key exists
    if (photo.storage_key) {
      try { await deleteFromStorage(photo.storage_key); } catch { /* ignore storage errors */ }
    }

    const { error: delErr } = await supabase.from('photos').delete().eq('id', req.params.photoId);
    if (delErr) throw delErr;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/photos/:photoId ─────────────────────────────────────────────────
router.get('/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('id', req.params.photoId)
      .single();
    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
