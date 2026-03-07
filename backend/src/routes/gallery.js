const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// ─── GET /api/gallery/:slug ───────────────────────────────────────────────────
// Returns event info + paginated photos for public gallery
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 24, password } = req.query;

    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, slug, date, venue, branding, settings, gallery_password, gallery_expires_at')
      .eq(slug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? 'id' : 'slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !event) return res.status(404).json({ error: 'Gallery not found' });

    // Check if gallery has expired
    if (event.gallery_expires_at && new Date(event.gallery_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Gallery has expired' });
    }

    // Password protection
    if (event.gallery_password) {
      if (!password) {
        return res.status(401).json({ error: 'PASSWORD_REQUIRED', eventName: event.name });
      }
      if (password !== event.gallery_password) {
        return res.status(403).json({ error: 'WRONG_PASSWORD' });
      }
    }

    // Fetch photos
    const offset = (Number(page) - 1) * Number(limit);
    const { data: photos, count } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at', { count: 'exact' })
      .eq('event_id', event.id)
      .not('mode', 'eq', 'ai') // show ai photos separately
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // Track gallery view
    await supabase.from('analytics').insert({
      event_id: event.id,
      action: 'gallery_viewed',
      metadata: { page },
    });

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
router.post('/:slug/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const { data: event } = await supabase
      .from('events')
      .select('gallery_password, name')
      .or(`id.eq.${req.params.slug},slug.eq.${req.params.slug}`)
      .single();

    if (!event) return res.status(404).json({ error: 'Not found' });
    if (password === event.gallery_password) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Wrong password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/gallery/track-download ────────────────────────────────────────
router.post('/track-download', async (req, res) => {
  try {
    const { photoId, eventId } = req.body;
    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'gallery_download',
      metadata: { photoId },
    });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
});

module.exports = router;
