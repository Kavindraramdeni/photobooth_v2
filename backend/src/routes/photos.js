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

// Multer: memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ─── ALL SPECIFIC ROUTES FIRST, wildcard /:photoId LAST ───────────────────

/**
 * POST /api/photos/upload
 */
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Body:', req.body);
    console.log('File:', req.file ? `${req.file.size} bytes` : 'MISSING');

    const { eventId, mode = 'single', sessionId } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    // Get event from DB by UUID
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    console.log('Event lookup:', event ? event.name : `NOT FOUND (error: ${eventError?.message})`);

    if (!event) return res.status(404).json({ error: 'Event not found', eventId });

    const photoId = uuidv4();
    const timestamp = Date.now();
    const storageKey = `events/${eventId}/photos/${photoId}_${timestamp}.jpg`;

    // Process image
    let processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    // Apply branding overlay
    try {
      if (event.branding) {
        processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
      }
    } catch (brandingErr) {
      console.error('Branding overlay failed (continuing without):', brandingErr.message);
    }

    // Upload to Supabase Storage
    const photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');
    console.log('Photo uploaded:', photoUrl);

    // Thumbnail
    const thumbBuffer = await sharp(processedBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbKey = `events/${eventId}/thumbs/${photoId}_thumb.jpg`;
    const thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    // QR + share URLs
    const galleryUrl = buildGalleryUrl(event.slug, photoId);
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

    // Save to DB
    const { error: dbError } = await supabase.from('photos').insert({
      id: photoId,
      event_id: eventId,
      session_id: sessionId,
      url: photoUrl,
      thumb_url: thumbUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode,
      created_at: new Date().toISOString(),
    });

    if (dbError) console.error('DB insert error:', dbError);

    // Analytics
    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'photo_taken',
      metadata: { mode, photoId },
    }).catch(e => console.error('Analytics error:', e));

    // Socket.IO
    try {
      const io = req.app.get('io');
      io?.to(`event-${eventId}`).emit('photo-taken', { photoId, thumbUrl, galleryUrl, mode });
    } catch (e) { /* non-critical */ }

    res.json({
      success: true,
      photo: {
        id: photoId,
        url: photoUrl,
        thumbUrl,
        galleryUrl,
        qrCode: qrDataUrl,
        whatsappUrl,
        downloadUrl: photoUrl,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/photos/gif
 */
router.post('/gif', upload.array('frames', 10), async (req, res) => {
  try {
    const { eventId, type = 'gif', sessionId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const frames = req.files.map((f) => f.buffer);

    const gifBuffer = type === 'boomerang'
      ? await createBoomerang(frames)
      : await createGIF(frames);

    const gifId = uuidv4();
    const storageKey = `events/${eventId}/gifs/${gifId}.gif`;
    const gifUrl = await uploadToStorage(gifBuffer, storageKey, 'image/gif');

    const galleryUrl = buildGalleryUrl(event?.slug || eventId, gifId);
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(gifUrl, event?.name);

    await supabase.from('photos').insert({
      id: gifId, event_id: eventId, session_id: sessionId,
      url: gifUrl, gallery_url: galleryUrl, storage_key: storageKey, mode: type,
    });

    res.json({ success: true, gif: { id: gifId, url: gifUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, type } });
  } catch (error) {
    console.error('GIF error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/photos/strip
 */
router.post('/strip', upload.array('photos', 4), async (req, res) => {
  try {
    const { eventId } = req.body;
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const photos = req.files.map((f) => f.buffer);
    const stripBuffer = await createPhotoStrip(photos, event?.branding || {});

    const stripId = uuidv4();
    const storageKey = `events/${eventId}/strips/${stripId}.jpg`;
    const stripUrl = await uploadToStorage(stripBuffer, storageKey, 'image/jpeg');
    const galleryUrl = buildGalleryUrl(event?.slug || eventId, stripId);
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    await supabase.from('photos').insert({
      id: stripId, event_id: eventId, url: stripUrl,
      gallery_url: galleryUrl, storage_key: storageKey, mode: 'strip',
    });

    res.json({ success: true, strip: { id: stripId, url: stripUrl, galleryUrl, qrCode: qrDataUrl } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/event/:eventId
 */
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;
    res.json({ photos: photos || [], page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/:photoId  ← MUST BE LAST (wildcard)
 */
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
