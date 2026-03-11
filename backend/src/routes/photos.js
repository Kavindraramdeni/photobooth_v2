const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const router = express.Router();

const { uploadToStorage } = require('../services/storage');
const { applyBrandingOverlay, createPhotoStrip } = require('../services/imageProcessor');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl, generateUniqueShortCode, generateStoriesImage } = require('../services/sharing');
const { createGIF, createBoomerang } = require('../services/gif');
const supabase = require('../services/database');

// ─── Webhook helper ───────────────────────────────────────────────────────────
async function fireWebhook(event, payload) {
  const webhookUrl = event?.settings?.webhookUrl;
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify({
      ...payload,
      event_id: event.id,
      event_name: event.name,
      timestamp: new Date().toISOString(),
    });
    const headers = { 'Content-Type': 'application/json' };
    if (event?.settings?.webhookSecret) {
      const crypto = require('crypto');
      headers['X-SnapBooth-Signature'] = crypto
        .createHmac('sha256', event.settings.webhookSecret)
        .update(body)
        .digest('hex');
    }
    await fetch(webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.warn('Webhook fire failed:', err.message);
  }
}

// Multer: memory storage for direct processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
});

/**
 * POST /api/photos/upload
 * Upload a photo, apply branding, generate QR
 */
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { eventId, mode = 'single', sessionId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    // Get event branding from DB
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const photoId = uuidv4();
    const timestamp = Date.now();
    const storageKey = `events/${eventId}/photos/${photoId}_${timestamp}.jpg`;

    // Process image: resize + apply branding
    let processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    if (event.branding) {
      processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
    }

    // Upload to R2
    const photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');

    // Also create thumbnail
    const thumbBuffer = await sharp(processedBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbKey = `events/${eventId}/thumbs/${photoId}_thumb.jpg`;
    const thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    // Build gallery URL and QR code
    const shortCode = await generateUniqueShortCode(supabase);
    const galleryUrl = buildGalleryUrl(event.slug, photoId, shortCode);
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

    // Save to database
    const { data: photo, error: dbError } = await supabase
      .from('photos')
      .insert({
        id: photoId,
        event_id: eventId,
        session_id: sessionId,
        url: photoUrl,
        thumb_url: thumbUrl,
        gallery_url: galleryUrl,
        storage_key: storageKey,
        short_code: shortCode,
        mode,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) console.error('DB insert error:', dbError);

    // Track analytics
    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'photo_taken',
      metadata: { mode, photoId },
    });

    // Emit via Socket.IO to admin dashboard
    const io = req.app.get('io');
    io.to(`event-${eventId}`).emit('photo-taken', {
      photoId,
      thumbUrl,
      galleryUrl,
      mode,
      timestamp: new Date().toISOString(),
    });

    // Fire webhook (non-blocking)
    fireWebhook(event, {
      trigger: 'photo.created',
      photo: { id: photoId, url: photoUrl, thumbUrl, galleryUrl, mode },
    });

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
 * Create GIF or Boomerang from multiple frames
 */
router.post('/gif', upload.array('frames', 10), async (req, res) => {
  try {
    const { eventId, type = 'gif', sessionId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();

    const frames = req.files.map((f) => f.buffer);
    let gifBuffer;

    if (type === 'boomerang') {
      gifBuffer = await createBoomerang(frames);
    } else {
      gifBuffer = await createGIF(frames);
    }

    const gifId = uuidv4();
    const storageKey = `events/${eventId}/gifs/${gifId}.gif`;
    const gifUrl = await uploadToStorage(gifBuffer, storageKey, 'image/gif');

    const galleryUrl = buildGalleryUrl(event?.slug || eventId, gifId);
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(gifUrl, event?.name);

    await supabase.from('photos').insert({
      id: gifId,
      event_id: eventId,
      session_id: sessionId,
      url: gifUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: type,
    });

    await supabase.from('analytics').insert({
      event_id: eventId,
      action: type === 'boomerang' ? 'boomerang_created' : 'gif_created',
      metadata: { frameCount: frames.length },
    });

    res.json({
      success: true,
      gif: {
        id: gifId,
        url: gifUrl,
        galleryUrl,
        qrCode: qrDataUrl,
        whatsappUrl,
        type,
      },
    });
  } catch (error) {
    console.error('GIF creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/photos/strip
 * Create a 4-photo strip
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

    res.json({
      success: true,
      strip: { id: stripId, url: stripUrl, galleryUrl, qrCode: qrDataUrl },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/event/:eventId
 * Get all photos for an event (for gallery/admin)
 */
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

    // Operators can request all photos including hidden ones
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

/**
 * GET /api/photos/:photoId
 * Get a single photo (for gallery page)
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

/**
 * GET /api/photos/event/:eventId/count
 * Fast photo count for limit enforcement
 */
router.get('/event/:eventId/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', req.params.eventId);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/photos/:photoId/moderate
 * Hide or unhide a photo (moderation queue)
 * Body: { is_hidden: boolean, reason?: string }
 */
router.patch('/:photoId/moderate', async (req, res) => {
  const { is_hidden, reason = '' } = req.body;
  if (typeof is_hidden !== 'boolean') {
    return res.status(400).json({ error: 'is_hidden (boolean) required' });
  }
  try {
    const { error } = await supabase
      .from('photos')
      .update({
        is_hidden,
        hidden_at: is_hidden ? new Date().toISOString() : null,
        hidden_by: is_hidden ? (reason || 'operator') : null,
      })
      .eq('id', req.params.photoId);

    if (error) throw error;
    res.json({ success: true, is_hidden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/photos/short/:shortCode
 * Resolve short code → photo (used by /p/[code] frontend page)
 */
router.get('/short/:shortCode', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('short_code', req.params.shortCode)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/:photoId/stories
 * Generate 9:16 Instagram Stories image with event branding.
 * Returns image/jpeg binary.
 */
router.get('/:photoId/stories', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, branding)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    // Fetch original photo buffer
    const photoRes = await fetch(photo.url);
    if (!photoRes.ok) return res.status(502).json({ error: 'Could not fetch photo' });
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer());

    const branding = photo.events?.branding || {};
    const storiesBuffer = await generateStoriesImage(photoBuffer, {
      eventName: branding.eventName || photo.events?.name || 'SnapBooth',
      primaryColor: branding.primaryColor || '#7c3aed',
    });

    const eventName = (branding.eventName || photo.events?.name || 'SnapBooth').replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${eventName}_Stories_${date}.jpg"`,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(storiesBuffer);
  } catch (err) {
    console.error('/stories error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Permanently delete a photo from DB and storage
 */
router.delete('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;

    // Get storage_key first so we can delete from R2
    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('storage_key, event_id')
      .eq('id', photoId)
      .single();

    if (fetchErr || !photo) return res.status(404).json({ error: 'Photo not found' });

    // Delete from R2 storage
    const { deleteFromStorage } = require('../services/storage');
    if (photo.storage_key) {
      try { await deleteFromStorage(photo.storage_key); } catch (e) { console.warn('R2 delete failed:', e.message); }
      // Also try thumb
      try {
        const thumbKey = photo.storage_key.replace('/photos/', '/thumbs/').replace(/(_\d+)\.jpg$/, '_thumb.jpg');
        await deleteFromStorage(thumbKey);
      } catch { /* thumb may not exist */ }
    }

    // Delete from DB
    const { error: dbErr } = await supabase.from('photos').delete().eq('id', photoId);
    if (dbErr) throw dbErr;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/event/:eventId/zip
 * Download all photos for an event as a ZIP
 */
router.get('/event/:eventId/zip', async (req, res) => {
  try {
    const { eventId } = req.params;
    const archiver = require('archiver');

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, mode, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!photos?.length) return res.status(404).json({ error: 'No photos found' });

    const { data: event } = await supabase.from('events').select('name').eq('id', eventId).single();
    const eventName = (event?.name || 'event').replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${eventName}_photos_${date}.zip"`,
    });

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const photo of photos) {
      try {
        const photoRes = await fetch(photo.url);
        if (!photoRes.ok) continue;
        const buffer = Buffer.from(await photoRes.arrayBuffer());
        const ext = photo.mode === 'gif' || photo.mode === 'boomerang' ? 'gif' : 'jpg';
        const filename = `${photo.mode}_${photo.id.slice(0, 8)}.${ext}`;
        archive.append(buffer, { name: filename });
      } catch { /* skip failed photo */ }
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

module.exports = router;
