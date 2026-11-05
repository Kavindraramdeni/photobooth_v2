/**
 * Backgrounds Routes - Green screen backgrounds management
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');

// Helper to check event ownership for a given eventId
async function checkEventOwner(eventId, userId) {
  if (!eventId || !userId) return false;
  const { data: event } = await supabase
    .from('events')
    .select('id, owner_id')
    .eq('id', eventId)
    .maybeSingle();
  return event && event.owner_id === userId;
}

// GET /api/backgrounds/event/:eventId or /api/backgrounds/:eventId
router.get(['/event/:eventId', '/:eventId'], async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { data: backgrounds } = await supabase
      .from('event_backgrounds')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true);

    res.json({ backgrounds: backgrounds || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/backgrounds/event/:eventId or /api/backgrounds/:eventId (Owner only)
router.post(['/event/:eventId', '/:eventId'], requireAuth, async (req, res) => {
  try {
    const { name, url } = req.body;
    const eventId = req.params.eventId;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL required' });
    }

    const isOwner = await checkEventOwner(eventId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    const { data: background, error } = await supabase
      .from('event_backgrounds')
      .insert({
        event_id: eventId,
        name,
        url,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, background });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/backgrounds/:bgId (Owner only)
router.patch('/:bgId', requireAuth, async (req, res) => {
  try {
    const { is_active } = req.body;

    const { data: existingBg } = await supabase
      .from('event_backgrounds')
      .select('id, event_id')
      .eq('id', req.params.bgId)
      .maybeSingle();

    if (!existingBg) {
      return res.status(404).json({ error: 'Background not found' });
    }

    const isOwner = await checkEventOwner(existingBg.event_id, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    const { data: background, error } = await supabase
      .from('event_backgrounds')
      .update({ is_active })
      .eq('id', req.params.bgId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, background });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/backgrounds/:bgId (Owner only)
router.delete('/:bgId', requireAuth, async (req, res) => {
  try {
    const { data: existingBg } = await supabase
      .from('event_backgrounds')
      .select('id, event_id')
      .eq('id', req.params.bgId)
      .maybeSingle();

    if (!existingBg) {
      return res.status(404).json({ error: 'Background not found' });
    }

    const isOwner = await checkEventOwner(existingBg.event_id, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    const { error } = await supabase
      .from('event_backgrounds')
      .delete()
      .eq('id', req.params.bgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
