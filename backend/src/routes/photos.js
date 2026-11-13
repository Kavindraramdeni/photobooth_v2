const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const router = express.Router();

const { uploadToStorage } = require('../services/storage');
const {
  applyBrandingOverlay,
  createPhotoStrip,
  applyBeautyMode,
  applyGlamFilter,
} = require('../services/imageProcessor');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl, generateUniqueShortCode, generateStoriesImage } = require('../services/sharing');
const { createGIF, createBoomerang } = require('../services/gif');
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');
const requireBoothSession = require('../middleware/requireBoothSession');
const { checkPhotoLimit, requireFeature } = require('../middleware/planEnforcement');
const { verifyToken } = require('../utils/token');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

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
  limits: { fileSize: 75 * 1024 * 1024 }, // 75MB for high-resolution booth uploads
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
const uploadPhotoFields = upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'file', maxCount: 1 }]);

function normalizeUploadedPhoto(req, res, next) {
  uploadPhotoFields(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large. Please upload an image under 75MB.' : err.message });
    }
    const file = req.files?.photo?.[0] || req.files?.file?.[0];
    if (file) req.file = file;
    next();
  });
}

router.post('/upload', normalizeUploadedPhoto, requireBoothSession, async (req, res) => {
  try {
    const { eventId, mode = 'single', sessionId, clientCaptureId, clientPhotoId, client_photo_id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    // Get event branding from DB
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Deduplication check: if clientPhotoId / client_photo_id / clientCaptureId exists, return existing photo immediately
    const clientKey = clientPhotoId || client_photo_id || clientCaptureId;
    if (clientKey) {
      let dedupeQuery = supabase
        .from('photos')
        .select('*')
        .eq('event_id', eventId);

      if (isUUID(clientKey)) {
        dedupeQuery = dedupeQuery.or(`id.eq.${clientKey},metadata->>clientPhotoId.eq.${clientKey},metadata->>client_photo_id.eq.${clientKey},metadata->>clientCaptureId.eq.${clientKey}`);
      } else {
        dedupeQuery = dedupeQuery.or(`metadata->>clientPhotoId.eq.${clientKey},metadata->>client_photo_id.eq.${clientKey},metadata->>clientCaptureId.eq.${clientKey}`);
      }

      const { data: existing } = await dedupeQuery.maybeSingle();

      if (existing) {
        return res.status(200).json({
          success: true,
          deduplicated: true,
          photo: existing,
          qrDataUrl: await generateQRDataURL(existing.gallery_url),
          whatsappUrl: buildWhatsAppUrl(existing.url, event.name),
          galleryUrl: existing.gallery_url,
          photoUrl: existing.url,
          thumbUrl: existing.thumb_url,
          shortCode: existing.short_code,
        });
      }
    }

    // Check photo limit using event's owner (not the guest)
    if (event.owner_id) {
      const { getUserPlanFeatures } = require('../middleware/planEnforcement');
      const { features } = await getUserPlanFeatures(event.owner_id);
      if (features.photoLimit !== -1) {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: ownerEvents } = await supabase.from('events').select('id').eq('owner_id', event.owner_id);
        const ownerEventIds = (ownerEvents || []).map(e => e.id);
        if (ownerEventIds.length > 0) {
          const { count } = await supabase.from('photos')
            .select('id', { count: 'exact', head: true })
            .in('event_id', ownerEventIds)
            .gte('created_at', monthStart);
          if ((count || 0) >= features.photoLimit) {
            return res.status(403).json({
              error: `Monthly photo limit reached. The event owner needs to upgrade their plan.`,
              upgradeUrl: '/pricing',
            });
          }
        }
      }
    }

    const photoId = (clientKey && isUUID(clientKey)) ? clientKey : uuidv4();
    const timestamp = Date.now();
    const storageKey = `events/${eventId}/photos/${photoId}_${timestamp}.jpg`;

    // Process image: resize + apply branding
    let processedBuffer;
    try {
      processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();
    } catch (imageError) {
      return res.status(415).json({ error: 'Unsupported or invalid image format. Please upload a JPG, PNG, WEBP, HEIC, or GIF image.' });
    }

    if (event.settings?.beautyLevel && Number(event.settings.beautyLevel) > 0) {
      processedBuffer = await applyBeautyMode(processedBuffer, Number(event.settings.beautyLevel));
    }

    if (event.settings?.glamMode && event.settings.glamMode !== 'off') {
      processedBuffer = await applyGlamFilter(processedBuffer, {
        mode: event.settings.glamMode,
        intensity: Number(event.settings.glamIntensity || 8),
      });
    }

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
    console.log('[photos/upload] short_code generated', { photoId, eventId, shortCode, galleryUrl });
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

    // Save to database
    const { data: photo, error: dbError } = await supabase
      .from('photos')
      .insert({
        id: photoId,
        event_id: eventId,
        owner_id: event.owner_id || null,
        session_id: sessionId,
        url: photoUrl,
        thumb_url: thumbUrl,
        gallery_url: galleryUrl,
        storage_key: storageKey,
        short_code: shortCode,
        mode,
        metadata: {
          clientPhotoId: clientKey || null,
          client_photo_id: clientKey || null,
          clientCaptureId: clientCaptureId || clientKey || null,
          sessionId: sessionId || null,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) throw dbError;
    console.log('[photos/upload] DB insert success', { photoId: photo.id, eventId, shortCode: photo.short_code });

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
        storage_key: storageKey,
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
router.post('/gif', upload.array('frames', 10), requireBoothSession, async (req, res) => {
  try {
    const { eventId, type = 'gif', sessionId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });
    if (!req.files?.length) return res.status(400).json({ error: 'No frames provided' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

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
    const shortCode = await generateUniqueShortCode(supabase);

    const galleryUrl = buildGalleryUrl(event.slug, gifId, shortCode);
    console.log('[photos/gif] short_code generated', { gifId, eventId, type, shortCode, galleryUrl });
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(gifUrl, event.name);

    const { error: gifInsertError } = await supabase.from('photos').insert({
      id: gifId,
      event_id: eventId,
      session_id: sessionId,
      url: gifUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: type,
      short_code: shortCode,
    });
    if (gifInsertError) throw gifInsertError;
    console.log('[photos/gif] DB insert success', { gifId, eventId, shortCode, type });

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
router.post('/strip', upload.array('photos', 4), requireBoothSession, async (req, res) => {
  try {
    const { eventId, sessionId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });
    if (!req.files?.length) return res.status(400).json({ error: 'No photos provided' });
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const photos = req.files.map((f) => f.buffer);
    const stripBuffer = await createPhotoStrip(photos, event?.branding || {});

    const stripId = uuidv4();
    const storageKey = `events/${eventId}/strips/${stripId}.jpg`;
    const stripUrl = await uploadToStorage(stripBuffer, storageKey, 'image/jpeg');
    const shortCode = await generateUniqueShortCode(supabase);

    const galleryUrl = buildGalleryUrl(event.slug, stripId, shortCode);
    console.log('[photos/strip] short_code generated', { stripId, eventId, shortCode, galleryUrl });
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(stripUrl, event.name);

    const { error: stripInsertError } = await supabase.from('photos').insert({
      id: stripId,
      event_id: eventId,
      session_id: sessionId,
      url: stripUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: 'strip',
      short_code: shortCode,
    });
    if (stripInsertError) throw stripInsertError;
    console.log('[photos/strip] DB insert success', { stripId, eventId, shortCode });

    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'strip_created',
      metadata: { frameCount: photos.length },
    });

    res.json({
      success: true,
      strip: { id: stripId, url: stripUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, downloadUrl: stripUrl },
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

    // Only allow viewing hidden photos if caller is the authenticated event owner
    let isOwner = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: ev } = await supabase.from('events').select('owner_id').eq('id', eventId).maybeSingle();
        if (ev && ev.owner_id === user.id) isOwner = true;
      }
    }

    if (!isOwner || include_hidden !== 'true') {
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
      .select('*, events(id, slug, name, branding, owner_id)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    if (photo.is_hidden) {
      let isOwner = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user && photo.events?.owner_id === user.id) {
          isOwner = true;
        }
      }
      if (!isOwner) {
        return res.status(404).json({ error: 'Photo not found' });
      }
    }

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
router.patch('/:photoId/moderate', requireAuth, async (req, res) => {
  const { is_hidden, reason = '' } = req.body;
  if (typeof is_hidden !== 'boolean') {
    return res.status(400).json({ error: 'is_hidden (boolean) required' });
  }
  try {
    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('event_id, events!inner(owner_id)')
      .eq('id', req.params.photoId)
      .single();

    if (fetchErr || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventOwnerId = Array.isArray(photo.events) ? photo.events[0]?.owner_id : photo.events?.owner_id;
    const isOwner = eventOwnerId && eventOwnerId === req.user.id;
    const isOperator = req.user.role === 'operator' && (req.user.eventId === photo.event_id || !req.user.eventId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isOperator && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: you do not have permission to moderate photos for this event' });
    }

    const { error } = await supabase
      .from('photos')
      .update({
        is_hidden,
        hidden_at: is_hidden ? new Date().toISOString() : null,
        hidden_by: is_hidden ? (reason || 'operator') : null,
      })
      .eq('id', req.params.photoId);

    if (error) throw error;

    // Broadcast live moderation event to slideshows & moderation hubs
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${photo.event_id}`).emit('photo-moderated', {
        photoId: req.params.photoId,
        is_hidden,
        eventId: photo.event_id,
      });
    }

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
      .select('*, events(name, branding, slug)')
      .eq('short_code', req.params.shortCode)
      .single();

    if (error || !photo || photo.is_hidden) return res.status(404).json({ error: 'Photo not found' });
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

    if (error || !photo || photo.is_hidden) return res.status(404).json({ error: 'Photo not found' });

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
router.delete('/:photoId', requireAuth, async (req, res) => {
  try {
    const { photoId } = req.params;

    // Verify ownership of the event before deleting
    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('storage_key, event_id, events!inner(owner_id)')
      .eq('id', photoId)
      .single();

    if (fetchErr || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventOwnerId = Array.isArray(photo.events) ? photo.events[0]?.owner_id : photo.events?.owner_id;
    const isOwner = eventOwnerId && eventOwnerId === req.user.id;
    const isOperator = req.user.role === 'operator' && (req.user.eventId === photo.event_id || !req.user.eventId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isOperator && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: you do not own the event this photo belongs to' });
    }

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

    // Broadcast live deletion event to slideshows & moderation hubs
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${photo.event_id}`).emit('photo-deleted', {
        photoId,
        eventId: photo.event_id,
      });
    }

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
router.get('/event/:eventId/zip', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify ownership
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('name, owner_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return res.status(404).json({ error: 'Event not found' });
    if (event.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    const archiver = require('archiver');

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, mode, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!photos?.length) return res.status(404).json({ error: 'No photos found' });

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

/**
 * POST /api/photos/burst
 * Accept multiple burst frames, store them individually
*/
router.post('/burst', upload.fields([
  { name: 'frame_0' }, { name: 'frame_1' }, { name: 'frame_2' },
  { name: 'frame_3' }, { name: 'frame_4' }, { name: 'frame_5' },
  { name: 'frame_6' }, { name: 'frame_7' }, { name: 'frame_8' }, { name: 'frame_9' },
]), requireBoothSession, async (req, res) => {
  try {
    const { eventId, sessionId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const files = req.files || {};
    const uploadedPhotos = [];

    for (let i = 0; i < 10; i++) {
      const fileArr = files[`frame_${i}`];
      if (!fileArr || !fileArr[0]) continue;
      const file = fileArr[0];
      const photoId = require('uuid').v4();
      const storageKey = `events/${eventId}/burst/${photoId}.jpg`;

      let publicUrl;
      try {
        publicUrl = await uploadToStorage(file.buffer, storageKey, 'image/jpeg');
      } catch (e) { console.warn('R2 burst upload failed:', e.message); continue; }
      const shortCode = await generateUniqueShortCode(supabase);

      const { data: photo } = await supabase.from('photos').insert({
        id: photoId, event_id: eventId, session_id: sessionId,
        url: publicUrl, mode: 'burst', short_code: shortCode,
      }).select().single();

      if (photo) uploadedPhotos.push(photo);
    }

    res.json({ photos: uploadedPhotos, count: uploadedPhotos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
