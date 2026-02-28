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
 * Helper: fetch a remote URL as a buffer
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * POST /api/photos/upload
 */
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { eventId, mode = 'single', sessionId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const photoId = uuidv4();
    const timestamp = Date.now();
    const storageKey = `events/${eventId}/photos/${photoId}_${timestamp}.jpg`;

    let processedBuffer = await sharp(req.file.buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    if (event.branding) {
      processedBuffer = await applyBrandingOverlay(processedBuffer, event.branding);
    }

    const photoUrl = await uploadToStorage(processedBuffer, storageKey, 'image/jpeg');

    const thumbBuffer = await sharp(processedBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbKey = `events/${eventId}/thumbs/${photoId}_thumb.jpg`;
    const thumbUrl = await uploadToStorage(thumbBuffer, thumbKey, 'image/jpeg');

    const galleryUrl = buildGalleryUrl(event.slug, photoId);
    const qrDataUrl = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photoUrl, event.name);

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
        mode,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) console.error('DB insert error:', dbError);

    try {
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'photo_taken',
        metadata: { mode, photoId },
      });
    } catch (e) {
      console.warn('Analytics insert failed:', e.message);
    }

    const io = req.app.get('io');
    io.to(`event-${eventId}`).emit('photo-taken', {
      photoId,
      thumbUrl,
      url: photoUrl,
      galleryUrl,
      mode,
      timestamp: new Date().toISOString(),
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
      gif: { id: gifId, url: gifUrl, galleryUrl, qrCode: qrDataUrl, whatsappUrl, type },
    });
  } catch (error) {
    console.error('GIF creation error:', error);
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
 * Get all photos for an event
 */
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at, storage_key')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;
    res.json({ photos, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/event/:eventId/zip
 * Download all event photos as a ZIP archive
 */
router.get('/event/:eventId/zip', async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event } = await supabase
      .from('events')
      .select('name, slug')
      .eq('id', eventId)
      .single();

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, url, mode, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!photos || photos.length === 0) {
      return res.status(404).json({ error: 'No photos found for this event' });
    }

    const eventName = (event?.name || 'snapbooth').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${eventName}_photos_${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    // Stream each photo into the ZIP
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        const buffer = await fetchBuffer(photo.url);
        const ext = photo.mode === 'gif' || photo.mode === 'boomerang' ? 'gif' : 'jpg';
        const photoName = `${String(i + 1).padStart(3, '0')}_${photo.mode}_${photo.id.slice(0, 8)}.${ext}`;
        archive.append(buffer, { name: photoName });
      } catch (err) {
        console.warn(`Skipping photo ${photo.id}:`, err.message);
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * DELETE /api/photos/:photoId
 * Permanently delete a photo from DB and storage
 */
router.delete('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;

    // Get photo record first to find storage key
    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('id, storage_key, event_id')
      .eq('id', photoId)
      .single();

    if (fetchErr || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete from Supabase Storage
    if (photo.storage_key) {
      try {
        await deleteFromStorage(photo.storage_key);
        // Also try to delete thumbnail
        const thumbKey = photo.storage_key
          .replace('/photos/', '/thumbs/')
          .replace(/(_[0-9]+\.jpg)$/, '_thumb.jpg');
        await deleteFromStorage(thumbKey).catch(() => {}); // ignore if missing
      } catch (storageErr) {
        console.warn('Storage delete failed (continuing):', storageErr.message);
      }
    }

    // Delete from database
    const { error: dbErr } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbErr) throw dbErr;

    // Emit deletion event to admin dashboard
    const io = req.app.get('io');
    if (photo.event_id) {
      io.to(`event-${photo.event_id}`).emit('photo-deleted', { photoId });
    }

    res.json({ success: true, photoId });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/photos/:photoId
 * Get a single photo
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
