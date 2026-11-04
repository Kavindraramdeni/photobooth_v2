/**
 * Email Routes - Send photos to guests
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const { sendPhotoEmail, sendBatchEmails } = require('../services/email');

// Handler for sending a single photo email
async function handleSendEmail(req, res) {
  try {
    const { email, name, photoId, eventId, shortCode } = req.body;

    if (!photoId || !email) {
      return res.status(400).json({ error: 'photoId and email are required' });
    }

    // Get photo
    const { data: photo } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .maybeSingle();

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Get event
    const targetEventId = eventId || photo.event_id;
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', targetEventId)
      .maybeSingle();

    // Send email
    const result = await sendPhotoEmail(email, name, photo.url, event, shortCode || photo.short_code);

    // Save lead
    await supabase.from('leads').insert({
      event_id: targetEventId,
      photo_id: photoId,
      email,
      name,
      opted_in: true,
      consented: true,
    }).catch(err => console.warn('Could not save lead:', err.message));

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message });
  }
}

// POST /api/email/send-email and /api/email/photo
router.post('/send-email', handleSendEmail);
router.post('/photo', handleSendEmail);

// POST /api/email/send-batch or /api/email/:id/send-batch
router.post(['/send-batch', '/:id/send-batch'], async (req, res) => {
  try {
    const { leads, eventId: bodyEventId } = req.body;
    const eventId = req.params.id || bodyEventId;

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    const result = await sendBatchEmails(eventId, leads);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
