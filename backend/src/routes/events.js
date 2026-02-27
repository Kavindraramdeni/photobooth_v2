const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50) + '-' + Date.now().toString(36);
}

// GET /api/events — list all
router.get('/', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, name, slug, date, venue, status, created_at, photos(count)')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ events: events || [] });
  } catch (error) {
    console.error('GET /events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:id — get single event by UUID or slug
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id.trim();
    console.log(`Looking up event: "${param}"`);

    // Fetch ALL active events and find manually
    // This avoids any RLS/filter issues with slug queries
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`Found ${events?.length || 0} total events`);

    // Match by slug OR id
    const event = (events || []).find(
      (e) => e.slug === param || e.id === param
    );

    if (!event) {
      console.log(`No event matched slug/id: "${param}"`);
      console.log('Available slugs:', (events || []).map(e => e.slug));
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log(`Found event: ${event.name} (${event.slug})`);
    res.json({ event });
  } catch (error) {
    console.error('GET /events/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events — create event
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
      primaryColor: '#7c3aed',
      secondaryColor: '#ffffff',
      footerText: name,
      overlayText: '',
      showDate: true,
      template: 'classic',
      logoUrl: null,
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
    console.error('POST /events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/events/:id — update event
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
    console.error('PUT /events/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/events/:id — archive event
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

// GET /api/events/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [photosResult, analyticsResult] = await Promise.all([
      supabase.from('photos').select('mode, session_id, created_at').eq('event_id', id),
      supabase.from('analytics').select('action, created_at').eq('event_id', id),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];

    res.json({
      stats: {
        totalPhotos: photos.filter((p) => p.mode === 'single').length,
        totalGIFs: photos.filter((p) => p.mode === 'gif').length,
        totalBoomerangs: photos.filter((p) => p.mode === 'boomerang').length,
        totalStrips: photos.filter((p) => p.mode === 'strip').length,
        totalAIGenerated: analytics.filter((a) => a.action === 'ai_generated').length,
        totalShares: analytics.filter((a) => a.action === 'photo_shared').length,
        totalPrints: analytics.filter((a) => a.action === 'photo_printed').length,
        totalSessions: new Set(photos.map((p) => p.session_id)).size,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
