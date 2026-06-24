const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const router = express.Router();
const supabase = require('../services/database');
const { uploadToStorage } = require('../services/storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/event/:eventId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('backgrounds').select('*').eq('event_id', req.params.eventId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ backgrounds: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/event/:eventId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Background image is required' });
    const id = randomUUID();
    const processed = await sharp(req.file.buffer).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    const key = `events/${req.params.eventId}/backgrounds/${id}.jpg`;
    const url = await uploadToStorage(processed, key, 'image/jpeg');
    const { data, error } = await supabase.from('backgrounds').insert({ id, event_id: req.params.eventId, name: req.body.name || 'Background', url, storage_key: key, is_active: true }).select().single();
    if (error) throw error;
    res.status(201).json({ background: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
