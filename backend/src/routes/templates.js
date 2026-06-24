/**
 * Templates Routes - Photo template management
 */

const express = require('express');
const router = express.Router();

// GET /api/events/:id/templates
router.get('/templates', async (req, res) => {
  try {
    const { data: templates } = await supabase
      .from('photo_templates')
      .select('*')
      .eq('event_id', req.params.id)
      .order('created_at', { ascending: false });

    res.json({ templates: templates || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:id/templates
router.post('/templates', async (req, res) => {
  try {
    const { name, elements, layout, width, height, is_default } = req.body;
    const eventId = req.params.id;

    if (!name) {
      return res.status(400).json({ error: 'Template name required' });
    }

    const { data: template } = await supabase
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

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/events/:id/templates/:templateId
router.patch('/templates/:templateId', async (req, res) => {
  try {
    const { name, elements, layout, width, height, is_default } = req.body;

    const { data: template } = await supabase
      .from('photo_templates')
      .update({
        name,
        elements,
        layout,
        width,
        height,
        is_default,
      })
      .eq('id', req.params.templateId)
      .select()
      .single();

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/events/:id/templates/:templateId
router.delete('/templates/:templateId', async (req, res) => {
  try {
    await supabase
      .from('photo_templates')
      .delete()
      .eq('id', req.params.templateId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
