const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');
const { generateQRDataURL } = require('../services/sharing');

function generateSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .concat('-', Date.now().toString(36));
}

/**
 * GET /api/events
 */
router.get('/', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select(`id, name, slug, date, venue, status, created_at, photos(count)`)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id/qr
 * Returns a QR code data URL for the booth URL of this event
 */
router.get('/:id/qr', async (req, res) => {
  try {
    const param = req.params.id.trim();

    let { data: event } = await supabase
      .from('events')
      .select('id, name, slug')
      .eq('id', param)
      .maybeSingle();

    if (!event) {
      const { data: bySlug } = await supabase
        .from('events')
        .select('id, name, slug')
        .eq('slug', param)
        .maybeSingle();
      event = bySlug;
    }

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
    const boothUrl = `${frontendUrl}/booth?event=${event.slug}`;
    const galleryUrl = `${frontendUrl}/gallery/${event.slug}`;

    const boothQR = await generateQRDataURL(boothUrl, { size: 400 });
    const galleryQR = await generateQRDataURL(galleryUrl, { size: 400 });

    res.json({
      boothUrl,
      galleryUrl,
      boothQR,
      galleryQR,
      eventName: event.name,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id/stats
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [photosResult, analyticsResult] = await Promise.all([
      supabase.from('photos').select('mode, created_at, session_id').eq('event_id', id),
      supabase.from('analytics').select('action, created_at').eq('event_id', id),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];

    const stats = {
      totalPhotos: photos.filter((p) => p.mode === 'single').length,
      totalGIFs: photos.filter((p) => p.mode === 'gif').length,
      totalBoomerangs: photos.filter((p) => p.mode === 'boomerang').length,
      totalStrips: photos.filter((p) => p.mode === 'strip').length,
      totalAIGenerated: analytics.filter((a) => a.action === 'ai_generated').length,
      totalShares: analytics.filter((a) => a.action === 'photo_shared').length,
      totalPrints: analytics.filter((a) => a.action === 'photo_printed').length,
      totalSessions: new Set(photos.map((p) => p.session_id).filter(Boolean)).size,
      totalAll: photos.length,
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id.trim();

    let { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('slug', param)
      .maybeSingle();

    if (!event) {
      const { data: byId } = await supabase
        .from('events')
        .select('*')
        .eq('id', param)
        .maybeSingle();
      event = byId;
    }

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events
 */
router.post('/', async (req, res) => {
  try {
    const { name, date, venue, clientName, clientEmail, branding = {}, settings = {} } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required' });
    }

    const eventId = uuidv4();
    const slug = generateSlug(name);

    const defaultBranding = {
      eventName: name,
      primaryColor: '#1a1a2e',
      secondaryColor: '#ffffff',
      footerText: name,
      overlayText: '',
      showDate: true,
      template: 'classic',
      logoUrl: null,
      idleMediaUrl: null,
      frameUrl: null,
      ...branding,
    };

    const defaultSettings = {
      countdownSeconds: 3,
      photosPerSession: 1,
      allowRetakes: true,
      allowAI: true,
      allowGIF: true,
      allowBoomerang: true,
      allowPrint: true,
      printCopies: 1,
      aiStyles: ['anime', 'vintage', 'watercolor', 'cyberpunk', 'oilpainting', 'comic'],
      sessionTimeout: 60,
      operatorPin: '1234',
      ...settings,
    };

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: eventId,
        name,
        slug,
        date,
        venue: venue || '',
        client_name: clientName || '',
        client_email: clientEmail || '',
        branding: defaultBranding,
        settings: defaultSettings,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/events/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: event, error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/events/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
