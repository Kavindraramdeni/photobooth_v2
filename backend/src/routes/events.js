const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');

/** Generate a URL-safe slug from event name */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 60);
}

// ─── GET /events ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*, photos(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = (events || []).map(e => ({
      ...e,
      photoCount: e.photos?.[0]?.count || 0,
    }));

    res.json({ events: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /events/:idOrSlug ────────────────────────────────────────────────────
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const query = supabase.from('events').select('*');
    const { data: event, error } = isUUID
      ? await query.eq('id', idOrSlug).single()
      : await query.eq('slug', idOrSlug).single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /events ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, date, venue, clientName, clientEmail,
      guestCount, notes, branding = {}, settings = {},
    } = req.body;

    if (!name || !date) return res.status(400).json({ error: 'name and date are required' });

    const baseSlug = generateSlug(name);
    // Ensure slug uniqueness
    const { data: existing } = await supabase
      .from('events').select('slug').like('slug', `${baseSlug}%`);
    const slug = (existing && existing.length > 0)
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        name,
        slug,
        date,
        venue: venue || '',
        client_name: clientName || '',
        client_email: clientEmail || '',
        guest_count: guestCount || null,
        notes: notes || '',
        status: 'active',
        branding: {
          primaryColor: '#7c3aed',
          showDate: true,
          template: 'classic',
          ...branding,
        },
        settings: {
          countdownSeconds: 3,
          sessionTimeout: 60,
          allowAI: true,
          allowGIF: true,
          allowBoomerang: true,
          allowPrint: true,
          allowRetakes: true,
          leadCapture: false,
          operatorPin: '1234',
          photosPerSession: 1,
          printCopies: 1,
          ...settings,
        },
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /events/:id ──────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, venue, date, branding, settings, status, notes, guestCount, clientName, clientEmail } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (venue !== undefined) updates.venue = venue;
    if (date !== undefined) updates.date = date;
    if (branding !== undefined) updates.branding = branding;
    if (settings !== undefined) updates.settings = settings;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (guestCount !== undefined) updates.guest_count = guestCount;
    if (clientName !== undefined) updates.client_name = clientName;
    if (clientEmail !== undefined) updates.client_email = clientEmail;
    updates.updated_at = new Date().toISOString();

    const { data: event, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /events/:id/duplicate ───────────────────────────────────────────────
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: original, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id).single();

    if (fetchErr || !original) return res.status(404).json({ error: 'Event not found' });

    const newName = `${original.name} (Copy)`;
    const baseSlug = generateSlug(newName);

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        name: newName,
        slug: `${baseSlug}-${Date.now()}`,
        date: original.date,
        venue: original.venue,
        client_name: original.client_name,
        client_email: original.client_email,
        guest_count: original.guest_count,
        notes: original.notes,
        status: 'inactive',  // duplicates start inactive
        branding: original.branding,
        settings: original.settings,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /events/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Cascade-delete photos first (if not using DB cascade)
    await supabase.from('analytics').delete().eq('event_id', id);
    await supabase.from('leads').delete().eq('event_id', id);
    await supabase.from('photos').delete().eq('event_id', id);
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /events/:id/stats ────────────────────────────────────────────────────
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [photosRes, analyticsRes] = await Promise.all([
      supabase.from('photos').select('mode, created_at').eq('event_id', id),
      supabase.from('analytics').select('action').eq('event_id', id),
    ]);

    const photos    = photosRes.data    || [];
    const analytics = analyticsRes.data || [];

    // Count unique session_ids from analytics to estimate sessions
    const stats = {
      totalPhotos:     photos.filter(p => ['single', 'strip'].includes(p.mode)).length,
      totalGIFs:       photos.filter(p => p.mode === 'gif').length,
      totalBoomerangs: photos.filter(p => p.mode === 'boomerang').length,
      totalStrips:     photos.filter(p => p.mode === 'strip').length,
      totalAIGenerated:photos.filter(p => p.mode === 'ai').length,
      totalShares:     analytics.filter(a => a.action === 'photo_shared').length,
      totalPrints:     analytics.filter(a => a.action === 'photo_printed').length,
      totalSessions:   analytics.filter(a => a.action === 'session_start').length,
    };

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /events/:id/qr ───────────────────────────────────────────────────────
router.get('/:idOrSlug/qr', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { generateQRDataURL } = require('../services/sharing');
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
    const boothUrl = `${FRONTEND_URL}/booth?event=${idOrSlug}`;
    const qrDataUrl = await generateQRDataURL(boothUrl);
    res.json({ qrDataUrl, boothUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
