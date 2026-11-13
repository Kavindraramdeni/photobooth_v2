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
const requireAuth = require('../middleware/requireAuth');

// ─── POST /api/leads ──────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const {
    eventId,
    photoId,
    email,
    phone,
    name,
    company,
    customAnswers,
    consented = true,
  } = req.body;

  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  if (!email && !phone && !name) return res.status(400).json({ error: 'At least name, email, or phone is required' });

  // Basic email validation if provided
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

    // Track in analytics with B2B metadata
    await supabase.from('analytics').insert({
      event_id: eventId,
      action:   'lead_captured',
      metadata: {
        photoId,
        hasEmail: !!email,
        hasPhone: !!phone,
        company: company || null,
        customAnswers: customAnswers || null,
      },
    }).catch(() => {});

    res.json({ success: true, lead: { id: data.id } });
  } catch (err) {
    console.error('/api/leads POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/leads/event/:eventId ───────────────────────────────────────────

router.get('/event/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event ownership or operator access
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('owner_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return res.status(404).json({ error: 'Event not found' });
    const isOwner = event.owner_id === req.user.id;
    const isOperator = req.user.role === 'operator' && (req.user.eventId === eventId || !req.user.eventId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isOperator && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    const { data, error } = await supabase
      .from('leads')
      .select('id, email, phone, name, consented, created_at, photo_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ leads: data || [], count: (data || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/leads/event/:eventId/export (CSV Download) ─────────────────────

router.get('/event/:eventId/export', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('name, owner_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return res.status(404).json({ error: 'Event not found' });
    const isOwner = event.owner_id === req.user.id;
    const isOperator = req.user.role === 'operator' && (req.user.eventId === eventId || !req.user.eventId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isOperator && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, email, phone, consented, created_at, photo_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Generate clean CSV
    const rows = [
      ['Lead ID', 'Captured At', 'Full Name', 'Email Address', 'Phone Number', 'Marketing Consented', 'Photo ID'],
    ];

    (leads || []).forEach((lead) => {
      rows.push([
        lead.id,
        new Date(lead.created_at).toLocaleString(),
        `"${(lead.name || '').replace(/"/g, '""')}"`,
        `"${(lead.email || '').replace(/"/g, '""')}"`,
        `"${(lead.phone || '').replace(/"/g, '""')}"`,
        lead.consented ? 'YES' : 'NO',
        lead.photo_id || '',
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\r\n');
    const safeEventName = (event.name || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${safeEventName}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
