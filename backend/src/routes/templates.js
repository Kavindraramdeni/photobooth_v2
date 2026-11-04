/**
 * Templates Routes - Photo template management
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// GET /api/templates/event/:eventId or /api/templates/:eventId
router.get(['/event/:eventId', '/:eventId'], async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { data: templates, error } = await supabase
      .from('photo_templates')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ templates: templates || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates/event/:eventId or /api/templates/:eventId
router.post(['/event/:eventId', '/:eventId'], async (req, res) => {
  try {
    const { name, elements, layout, width, height, is_default } = req.body;
    const eventId = req.params.eventId;

    if (!name) {
      return res.status(400).json({ error: 'Template name required' });
    }

    const { data: template, error } = await supabase
      .from('photo_templates')
      .insert({
        event_id: eventId,
        name,
        elements: elements || [],
        layout: layout || 'custom',
        width: width || 1200,
        height: height || 1800,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/templates/:templateId
router.patch('/:templateId', async (req, res) => {
  try {
    const { name, elements, layout, width, height, is_default } = req.body;

    const { data: template, error } = await supabase
      .from('photo_templates')
      .update({
        name,
        elements,
        layout,
        width,
        height,
        is_default,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.templateId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/templates/:templateId
router.delete('/:templateId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('photo_templates')
      .delete()
      .eq('id', req.params.templateId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
