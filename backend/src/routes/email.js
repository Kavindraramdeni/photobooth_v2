/**
 * Email Routes - Send photos to guests
 */

const express = require('express');
const router = express.Router();
const { sendPhotoEmail, sendBatchEmails } = require('../services/email');

// POST /api/photos/send-email
router.post('/send-email', async (req, res) => {
  try {
    const { email, name, photoId, eventId, shortCode } = req.body;

    // Get photo
    const { data: photo } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Get event
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    // Send email
    const result = await sendPhotoEmail(email, name, photo.url, event, shortCode);

    // Save lead
    await supabase.from('leads').insert({
      event_id: eventId,
      photo_id: photoId,
      email,
      name,
      opted_in: true,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:id/send-batch
router.post('/send-batch', async (req, res) => {
  try {
    const { leads } = req.body;
    const eventId = req.params.id;

    const result = await sendBatchEmails(eventId, leads);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
