const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const supabase = require('../services/database');

router.get('/event/:eventId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('templates').select('*').eq('event_id', req.params.eventId).order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ templates: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/event/:eventId', async (req, res) => {
  try {
    const id = randomUUID();
    const { name, layout, isDefault = false } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });
    const payload = { id, event_id: req.params.eventId, name, layout: layout || {}, is_default: !!isDefault, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('templates').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json({ template: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:templateId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('templates').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', req.params.templateId).select().single();
    if (error) throw error;
    res.json({ template: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
