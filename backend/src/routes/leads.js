/**
 * backend/src/routes/leads.js
 *
 * Routes:
 *   POST /api/leads             — submit a lead (email/phone captured from guest)
 *   GET  /api/leads/event/:id   — get all leads for an event (operator/admin only)
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../services/database');

// ─── POST /api/leads ──────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { eventId, photoId, email, phone, name, consented = true } = req.body;

  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

  // Basic email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        event_id:  eventId,
        photo_id:  photoId || null,
        email:     email   || null,
        phone:     phone   || null,
        name:      name    || null,
        consented: !!consented,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Track in analytics
    await supabase.from('analytics').insert({
      event_id: eventId,
      action:   'lead_captured',
      metadata: { photoId, hasEmail: !!email, hasPhone: !!phone },
    });

    res.json({ success: true, lead: { id: data.id } });
  } catch (err) {
    console.error('/api/leads POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/leads/event/:eventId ───────────────────────────────────────────

router.get('/event/:eventId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('id, email, phone, name, consented, created_at, photo_id')
      .eq('event_id', req.params.eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ leads: data || [], count: (data || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
