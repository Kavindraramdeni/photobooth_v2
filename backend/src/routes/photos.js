const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const router = express.Router();

const { uploadToStorage, deleteFromStorage } = require('../services/storage');
const { applyBrandingOverlay, createPhotoStrip } = require('../services/imageProcessor');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl, generateUniqueShortCode } = require('../services/sharing');
const { createGIF, createBoomerang, createSlowMotionGIF } = require('../services/gif');
const supabase = require('../services/database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';

// ─── POST /photos/upload ──────────────────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { eventId, mode = 'single', sessionId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId)  return res.status(400).json({ error: 'Event ID required' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const photoId = uuidv4();
    const timestamp = Date.now();
    const storageKey = `events/${eventId}/photos/${photoId}_${timestamp}.jpg`;

    let processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    if (event.branding) {
      try { processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding); }
      catch (e) { console.warn('[photos] branding overlay failed:', e.message); }
    }

    const photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');

    const thumbBuffer = await sharp(processedBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbKey = `events/${eventId}/thumbs/${photoId}_thumb.jpg`;
    const thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    const shortCode = await generateUniqueShortCode(supabase);
    const galleryUrl = `${FRONTEND_URL}/p/${shortCode}`;
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`📸 My photo from ${event.name}! View & download: ${galleryUrl}`)}`;

    await supabase.from('photos').insert({
      id: photoId, event_id: eventId, session_id: sessionId,
      url: photoUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, short_code: shortCode, mode,
      created_at: new Date().toISOString(),
    });

    await supabase.from('analytics').insert({
      event_id: eventId, action: 'photo_taken', metadata: { mode, photoId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('photo-taken', {
        photoId, thumbUrl, galleryUrl, mode, timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      photo: {
        id: photoId, url: photoUrl, thumbUrl, galleryUrl,
        qrCode: qrDataUrl, whatsappUrl, downloadUrl: photoUrl, mode,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /photos/gif ─────────────────────────────────────────────────────────
// FIX: was silently counting wrong mode; now correctly saves mode as 'gif' or 'boomerang'
router.post('/gif', upload.array('frames', 12), async (req, res) => {
  try {
    const { eventId, type = 'gif', sessionId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });
    if (req.files.length < 2) return res.status(400).json({ error: 'At least 2 frames required for GIF' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const frames = req.files.map(f => f.buffer);

    console.log(`[gif] creating ${type} from ${frames.length} frames for event ${eventId}`);

    let gifBuffer;
    if (type === 'boomerang') {
      gifBuffer = await createBoomerang(frames);
    } else {
      gifBuffer = await createGIF(frames);
    }

    const gifId = uuidv4();
    const storageKey = `events/${eventId}/gifs/${gifId}.gif`;
    const gifUrl = await uploadToStorage(gifBuffer, storageKey, 'image/gif');

    const shortCode = await generateUniqueShortCode(supabase);
    const galleryUrl = `${FRONTEND_URL}/p/${shortCode}`;
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`🎬 My ${type} from ${event?.name || 'SnapBooth'}! ${galleryUrl}`)}`;

    // Use first frame as thumbnail
    const thumbBuffer = await sharp(frames[0])
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 75 })
      .toBuffer();
    const thumbKey = `events/${eventId}/thumbs/${gifId}_thumb.jpg`;
    const thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    await supabase.from('photos').insert({
      id: gifId, event_id: eventId, session_id: sessionId,
      url: gifUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, short_code: shortCode,
      mode: type, // 'gif' or 'boomerang' — was missing before!
      created_at: new Date().toISOString(),
    });

    await supabase.from('analytics').insert({
      event_id: eventId,
      action: type === 'boomerang' ? 'boomerang_created' : 'gif_created',
      metadata: { frameCount: frames.length, gifId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('photo-taken', {
        photoId: gifId, thumbUrl, galleryUrl, mode: type,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      gif: { id: gifId, url: gifUrl, thumbUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, type, mode: type },
    });
  } catch (error) {
    console.error('GIF creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /photos/burst ───────────────────────────────────────────────────────
// Slow-motion burst: 10 frames → smooth 4fps GIF
router.post('/burst', upload.array('frames', 12), async (req, res) => {
  try {
    const { eventId, sessionId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });

    const { data: event } = await supabase.from('events').select('name, slug').eq('id', eventId).single();
    const frames = req.files.map(f => f.buffer);

    const gifBuffer = await createSlowMotionGIF(frames);

    const gifId = uuidv4();
    const storageKey = `events/${eventId}/gifs/${gifId}_slomo.gif`;
    const gifUrl = await uploadToStorage(gifBuffer, storageKey, 'image/gif');

    const shortCode = await generateUniqueShortCode(supabase);
    const galleryUrl = `${FRONTEND_URL}/p/${shortCode}`;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    const thumbBuffer = await sharp(frames[0]).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 75 }).toBuffer();
    const thumbUrl = await uploadToStorage(thumbBuffer, `events/${eventId}/thumbs/${gifId}_thumb.jpg`, 'image/jpeg');

    await supabase.from('photos').insert({
      id: gifId, event_id: eventId, session_id: sessionId,
      url: gifUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, short_code: shortCode, mode: 'gif',
    });

    res.json({ success: true, gif: { id: gifId, url: gifUrl, galleryUrl, qrCode: qrDataUrl, type: 'burst' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /photos/strip ───────────────────────────────────────────────────────
router.post('/strip', upload.array('photos', 4), async (req, res) => {
  try {
    const { eventId, sessionId } = req.body;
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();

    const photos = req.files.map(f => f.buffer);
    const stripBuffer = await createPhotoStrip(photos, event?.branding || {});

    const stripId = uuidv4();
    const storageKey = `events/${eventId}/strips/${stripId}.jpg`;
    const stripUrl = await uploadToStorage(stripBuffer, storageKey, 'image/jpeg');

    const shortCode = await generateUniqueShortCode(supabase);
    const galleryUrl = `${FRONTEND_URL}/p/${shortCode}`;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    const thumbBuffer = await sharp(stripBuffer).resize(300, null, { fit: 'inside' }).jpeg({ quality: 75 }).toBuffer();
    const thumbUrl = await uploadToStorage(thumbBuffer, `events/${eventId}/thumbs/${stripId}_thumb.jpg`, 'image/jpeg');

    await supabase.from('photos').insert({
      id: stripId, event_id: eventId, session_id: sessionId,
      url: stripUrl, thumb_url: thumbUrl, gallery_url: galleryUrl,
      storage_key: storageKey, short_code: shortCode, mode: 'strip',
    });

    res.json({ success: true, strip: { id: stripId, url: stripUrl, thumbUrl, galleryUrl, qrCode: qrDataUrl, mode: 'strip' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /photos/event/:eventId ───────────────────────────────────────────────
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 50, include_hidden = 'false' } = req.query;

    let query = supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at, is_hidden, hidden_by, short_code')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (include_hidden !== 'true') {
      query = query.or('is_hidden.is.null,is_hidden.eq.false');
    }

    const { data: photos, error } = await query;
    if (error) throw error;
    res.json({ photos, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /photos/event/:eventId/count ─────────────────────────────────────────
router.get('/event/:eventId/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('photos').select('id', { count: 'exact', head: true }).eq('event_id', req.params.eventId);
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /photos/short/:shortCode ─────────────────────────────────────────────
router.get('/short/:shortCode', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('short_code', req.params.shortCode)
      .single();
    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });
    // Normalise: front-end expects photo.event not photo.events
    photo.event = photo.events;
    delete photo.events;
    res.json({ photo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /photos/:photoId ─────────────────────────────────────────────────────
router.get('/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('id', req.params.photoId)
      .single();
    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });
    photo.event = photo.events;
    delete photo.events;
    res.json({ photo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── PATCH /photos/:photoId/moderate ─────────────────────────────────────────
router.patch('/:photoId/moderate', async (req, res) => {
  const { is_hidden, reason = '' } = req.body;
  if (typeof is_hidden !== 'boolean') return res.status(400).json({ error: 'is_hidden (boolean) required' });
  try {
    const { error } = await supabase.from('photos').update({
      is_hidden, hidden_at: is_hidden ? new Date().toISOString() : null,
      hidden_by: is_hidden ? (reason || 'operator') : null,
    }).eq('id', req.params.photoId);
    if (error) throw error;
    res.json({ success: true, is_hidden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /photos/:photoId ──────────────────────────────────────────────────
router.delete('/:photoId', async (req, res) => {
  try {
    const { data: photo } = await supabase.from('photos').select('storage_key').eq('id', req.params.photoId).single();
    if (photo?.storage_key) {
      try { await deleteFromStorage(photo.storage_key); } catch (e) { console.warn('R2 delete failed:', e.message); }
    }
    const { error } = await supabase.from('photos').delete().eq('id', req.params.photoId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /photos/event/:eventId/zip ──────────────────────────────────────────
router.get('/event/:eventId/zip', async (req, res) => {
  try {
    const { eventId } = req.params;
    const archiver = require('archiver');
    const { data: photos } = await supabase.from('photos')
      .select('id, url, mode, created_at').eq('event_id', eventId).order('created_at', { ascending: false });
    if (!photos?.length) return res.status(404).json({ error: 'No photos found' });
    const { data: event } = await supabase.from('events').select('name').eq('id', eventId).single();
    const eventName = (event?.name || 'event').replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${eventName}_photos_${date}.zip"` });
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    for (const photo of photos) {
      try {
        const photoRes = await fetch(photo.url);
        if (!photoRes.ok) continue;
        const buffer = Buffer.from(await photoRes.arrayBuffer());
        const ext = photo.mode === 'gif' || photo.mode === 'boomerang' ? 'gif' : 'jpg';
        archive.append(buffer, { name: `${photo.mode}_${photo.id.slice(0, 8)}.${ext}` });
      } catch { /* skip */ }
    }
    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

module.exports = router;
