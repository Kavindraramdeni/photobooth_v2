const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// ─── GET /gallery/event/:eventId ─────────────────────────────────────────────
// Public event gallery — returns visible (non-hidden) photos only
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.min(48, parseInt(req.query.pageSize) || 24);
    const offset   = (page - 1) * pageSize;

    // Fetch event for branding + privacy check
    const { data: event } = await supabase
      .from('events')
      .select('id, name, slug, branding, settings, status')
      .or(`id.eq.${eventId},slug.eq.${eventId}`)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Password-protected gallery
    const galleryPassword = event.settings?.galleryPassword;
    if (galleryPassword) {
      const provided = req.headers['x-gallery-password'] || req.query.password;
      if (provided !== galleryPassword) {
        return res.status(401).json({
          error: 'Gallery is password-protected',
          passwordRequired: true,
        });
      }
    }

    // Fetch photos (visible only)
    const { data: photos, count } = await supabase
      .from('photos')
      .select('id, url, thumb_url, gallery_url, mode, created_at, short_code', { count: 'exact' })
      .eq('event_id', event.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    res.json({
      event: {
        id: event.id,
        name: event.name,
        branding: event.branding,
      },
      photos: photos || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /gallery/photo/:photoId ─────────────────────────────────────────────
// Single photo + its event branding — used by /gallery/[photoId] page
router.get('/photo/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;

    const { data: photo } = await supabase
      .from('photos')
      .select(`
        id, url, thumb_url, gallery_url, download_url, mode, created_at, short_code,
        event:events(id, name, slug, branding)
      `)
      .eq('id', photoId)
      .single();

    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.is_hidden) return res.status(403).json({ error: 'Photo is not available' });

    res.json({ photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
