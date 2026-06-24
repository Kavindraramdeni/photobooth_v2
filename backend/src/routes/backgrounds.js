/**
 * Backgrounds Routes - Green screen backgrounds management
 */

const express = require('express');
const router = express.Router();

// GET /api/events/:id/backgrounds
router.get('/backgrounds', async (req, res) => {
  try {
    const { data: backgrounds } = await supabase
      .from('event_backgrounds')
      .select('*')
      .eq('event_id', req.params.id)
      .eq('is_active', true);

    res.json({ backgrounds: backgrounds || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:id/backgrounds
router.post('/backgrounds', async (req, res) => {
  try {
    const { name, url } = req.body;
    const eventId = req.params.id;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL required' });
    }

    const { data: background } = await supabase
      .from('event_backgrounds')
      .insert({
        event_id: eventId,
        name,
        url,
        is_active: true,
      })
      .select()
      .single();

    res.json({ success: true, background });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/events/:id/backgrounds/:bgId
router.patch('/backgrounds/:bgId', async (req, res) => {
  try {
    const { is_active } = req.body;

    const { data: background } = await supabase
      .from('event_backgrounds')
      .update({ is_active })
      .eq('id', req.params.bgId)
      .select()
      .single();

    res.json({ success: true, background });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/events/:id/backgrounds/:bgId
router.delete('/backgrounds/:bgId', async (req, res) => {
  try {
    await supabase
      .from('event_backgrounds')
      .delete()
      .eq('id', req.params.bgId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
