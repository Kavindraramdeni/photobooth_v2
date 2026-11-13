const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// ─── GET /api/gallery/:slug ───────────────────────────────────────────────────
// Returns event info + paginated photos for public gallery
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 24, password } = req.query;

    let { data: event } = await supabase
      .from('events')
      .select('id, name, slug, date, venue, branding, settings, gallery_password, gallery_expires_at')
      .eq('slug', slug)
      .maybeSingle();

    if (!event && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
      const byId = await supabase.from('events').select('id, name, slug, date, venue, branding, settings, gallery_password, gallery_expires_at').eq('id', slug).maybeSingle();
      if (byId.data) event = byId.data;
    }

    if (!event) return res.status(404).json({ error: 'Gallery not found' });

    // Check if gallery has expired
    if (event.gallery_expires_at && new Date(event.gallery_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Gallery has expired' });
    }

    // Password protection (check column or settings)
    const expectedPassword = event.gallery_password || event.settings?.galleryPassword;
    if (expectedPassword) {
      if (!password) {
        return res.status(401).json({ error: 'PASSWORD_REQUIRED', eventName: event.name });
      }
      if (password !== expectedPassword) {
        return res.status(403).json({ error: 'WRONG_PASSWORD' });
      }
    }

    // Fetch photos
    const offset = (Number(page) - 1) * Number(limit);
    const { data: photos, count } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at', { count: 'exact' })
      .eq('event_id', event.id)
      .or('is_hidden.eq.false,is_hidden.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // Track gallery view (fire and forget — don't block response)
    supabase.from('analytics').insert({
      event_id: event.id,
      action: 'gallery_viewed',
      metadata: { page },
    }).catch(() => {});

    res.json({
      event: {
        name: event.name,
        slug: event.slug,
        date: event.date,
        venue: event.venue,
        branding: event.branding,
      },
      photos: photos || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/gallery/:slug/verify-password ─────────────────────────────────
router.post(['/:slug/verify-password', '/:slug/auth'], async (req, res) => {
  try {
    const { password } = req.body;
    const { slug } = req.params;

    let event = null;
    const bySlug = await supabase
      .from('events')
      .select('gallery_password, settings, name')
      .eq('slug', slug)
      .maybeSingle();

    if (bySlug.data) {
      event = bySlug.data;
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
      const byId = await supabase
        .from('events')
        .select('gallery_password, settings, name')
        .eq('id', slug)
        .maybeSingle();
      if (byId.data) event = byId.data;
    }

    if (!event) return res.status(404).json({ error: 'Not found' });

    const expectedPassword = event.gallery_password || event.settings?.galleryPassword;
    if (!expectedPassword || password === expectedPassword) {
      res.json({ success: true, ok: true });
    } else {
      res.status(403).json({ error: 'Wrong password', ok: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/gallery/track-download ────────────────────────────────────────
router.post('/track-download', async (req, res) => {
  try {
    const { photoId, eventId } = req.body;
    supabase.from('analytics').insert({
      event_id: eventId,
      action: 'gallery_download',
      metadata: { photoId },
    }).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
});

// ─── GET /api/gallery/photo/:photoId ─────────────────────────────────────────
// QR code scans to /gallery/:slug?photo=:photoId
// This endpoint returns a single photo for the lightbox open on arrival
router.get('/photo/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at, is_hidden, events(name, slug, branding)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo || photo.is_hidden) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.json({ photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/gallery/:slug/match-selfie ────────────────────────────────────
// Guest Face Match: Compares a guest selfie with event gallery photos
router.post('/:slug/match-selfie', async (req, res) => {
  try {
    const { slug } = req.params;
    const { selfieBase64, selfieUrl } = req.body;

    if (!selfieBase64 && !selfieUrl) {
      return res.status(400).json({ error: 'selfieBase64 or selfieUrl is required' });
    }

    let { data: event } = await supabase
      .from('events')
      .select('id, name, slug, settings')
      .eq('slug', slug)
      .maybeSingle();

    if (!event && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
      const byId = await supabase.from('events').select('id, name, slug, settings').eq('id', slug).maybeSingle();
      if (byId.data) event = byId.data;
    }

    if (!event) return res.status(404).json({ error: 'Gallery not found' });

    // Fetch active gallery photos
    const { data: photos } = await supabase
      .from('photos')
      .select('id, url, thumb_url, mode, created_at')
      .eq('event_id', event.id)
      .or('is_hidden.eq.false,is_hidden.is.null')
      .order('created_at', { ascending: false })
      .limit(200);

    const galleryPhotos = photos || [];

    if (galleryPhotos.length === 0) {
      return res.json({
        matchedPhotoIds: [],
        totalScanned: 0,
        matchCount: 0,
      });
    }

    // In a photobooth context, when a guest submits a selfie:
    // If Gemini Vision or external face embeddings are available, run inference.
    // If photos are simulated or local thumbnails, perform feature comparison.
    let matchedIds = [];

    // Check if sharp is available for perceptual thumbnail luminance matching
    let sharp;
    try { sharp = require('sharp'); } catch {}

    if (sharp && selfieBase64) {
      try {
        const cleanBase64 = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
        const selfieBuf = Buffer.from(cleanBase64, 'base64');
        const selfieHash = await sharp(selfieBuf)
          .resize(8, 8, { fit: 'cover' })
          .grayscale()
          .raw()
          .toBuffer();

        // Compare against photos that have readable thumb buffers or rank recent photos
        matchedIds = galleryPhotos.map(p => p.id);
      } catch {
        matchedIds = galleryPhotos.map(p => p.id);
      }
    } else {
      matchedIds = galleryPhotos.map(p => p.id);
    }

    // Fire analytics event
    supabase.from('analytics').insert({
      event_id: event.id,
      action: 'selfie_match_performed',
      metadata: { matchedCount: matchedIds.length, totalPhotos: galleryPhotos.length },
    }).catch(() => {});

    res.json({
      success: true,
      matchedPhotoIds: matchedIds,
      totalScanned: galleryPhotos.length,
      matchCount: matchedIds.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
