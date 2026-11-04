/**
 * Backgrounds Routes - Green screen backgrounds management
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

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

// POST /api/backgrounds/event/:eventId or /api/backgrounds/:eventId
router.post(['/event/:eventId', '/:eventId'], async (req, res) => {
  try {
    const { name, url } = req.body;
    const eventId = req.params.eventId;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL required' });
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

// PATCH /api/backgrounds/:bgId
router.patch('/:bgId', async (req, res) => {
  try {
    const { is_active } = req.body;

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

// DELETE /api/backgrounds/:bgId
router.delete('/:bgId', async (req, res) => {
  try {
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
