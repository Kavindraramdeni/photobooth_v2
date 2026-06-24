const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const { sendPhotoEmail, buildPhotoEmail, isEmailConfigured, validateEmail } = require('../services/email');

router.get('/status', (req, res) => {
  res.json({ configured: isEmailConfigured() });
});

router.post('/photo', async (req, res) => {
  const { eventId, photoId, email, name, message, consented = true } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  if (!photoId) return res.status(400).json({ error: 'photoId is required' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Valid email is required' });

  try {
    const [{ data: event, error: eventError }, { data: photo, error: photoError }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('photos').select('*').eq('id', photoId).single(),
    ]);
    if (eventError || !event) return res.status(404).json({ error: 'Event not found' });
    if (photoError || !photo) return res.status(404).json({ error: 'Photo not found' });

    const emailContent = buildPhotoEmail({ event, photo, message });
    await sendPhotoEmail({
      to: email,
      ...emailContent,
      fromName: event.settings?.emailFromName || event.branding?.eventName || event.name,
      replyTo: event.settings?.emailReplyTo,
    });

    await supabase.from('leads').insert({
      event_id: eventId,
      photo_id: photoId,
      email,
      name: name || null,
      consented: !!consented,
      created_at: new Date().toISOString(),
    });
    await supabase.from('analytics').insert({ event_id: eventId, action: 'email_sent', metadata: { photoId } });

    res.json({ success: true });
  } catch (err) {
    console.error('/api/email/photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
