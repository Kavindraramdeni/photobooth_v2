const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// ─── POST /share/email ────────────────────────────────────────────────────────
// Sends a branded HTML email with the photo link via Resend
router.post('/email', async (req, res) => {
  try {
    const { photoId, email, eventId } = req.body;
    if (!photoId || !email) return res.status(400).json({ error: 'photoId and email required' });

    // Fetch photo + event data
    const { data: photo } = await supabase
      .from('photos')
      .select('url, gallery_url, mode, event:events(name, branding, settings)')
      .eq('id', photoId)
      .single();

    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const event = photo.event;
    const branding = event?.branding || {};
    const settings = event?.settings || {};
    const eventName = branding.eventName || event?.name || 'SnapBooth AI';
    const primaryColor = branding.primaryColor || '#7c3aed';
    const fromName = settings.emailFromName || eventName;
    const replyTo = settings.emailReplyTo || null;
    const photoUrl = photo.gallery_url || photo.url;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
    const galleryLink = photo.gallery_url || `${FRONTEND_URL}/gallery/${photoId}`;

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return res.status(503).json({ error: 'Email service not configured. Add RESEND_API_KEY to env.' });
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:${primaryColor};border-radius:12px;padding:10px 18px;">
        <span style="color:white;font-weight:900;font-size:16px;">📷 ${eventName}</span>
      </div>
    </div>
    <div style="background:#16162a;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
      <img src="${photoUrl}" alt="Your photo" style="width:100%;display:block;max-height:400px;object-fit:cover;" />
      <div style="padding:24px;text-align:center;">
        <h2 style="color:white;margin:0 0 8px;font-size:20px;">Your photo is ready! 🎉</h2>
        <p style="color:rgba(255,255,255,0.5);margin:0 0 24px;font-size:14px;">
          Captured at ${eventName}. Download it to your camera roll or share it with friends.
        </p>
        <a href="${galleryLink}"
           style="display:inline-block;background:${primaryColor};color:white;text-decoration:none;
                  font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;">
          📥 Download My Photo
        </a>
        <p style="color:rgba(255,255,255,0.25);margin:20px 0 0;font-size:11px;">
          Powered by SnapBooth AI
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const emailPayload = {
      from: `${fromName} <noreply@snapbooth.ai>`,
      to: [email],
      subject: `📸 Your photo from ${eventName} is ready!`,
      html,
    };
    if (replyTo) emailPayload.reply_to = replyTo;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    // Track
    if (eventId) {
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'photo_emailed',
        metadata: { photoId, email },
      }).catch(() => {});
    }

    res.json({ success: true, message: `Email sent to ${email}` });
  } catch (err) {
    console.error('Email share error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /share/sms ──────────────────────────────────────────────────────────
// Sends an SMS with the photo link via Twilio
router.post('/sms', async (req, res) => {
  try {
    const { photoId, phone, eventId } = req.body;
    if (!photoId || !phone) return res.status(400).json({ error: 'photoId and phone required' });

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return res.status(503).json({ error: 'SMS service not configured. Add TWILIO_* env vars.' });
    }

    const { data: photo } = await supabase
      .from('photos')
      .select('gallery_url, event:events(name, branding)')
      .eq('id', photoId)
      .single();

    const eventName = photo?.event?.branding?.eventName || photo?.event?.name || 'SnapBooth AI';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
    const link = photo?.gallery_url || `${FRONTEND_URL}/gallery/${photoId}`;

    const body = `📸 Your photo from ${eventName} is ready!\n\nDownload it here: ${link}\n\n— SnapBooth AI`;

    // Twilio REST API
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: TWILIO_PHONE_NUMBER, Body: body }),
      }
    );

    if (!twilioRes.ok) {
      const err = await twilioRes.json();
      throw new Error(`Twilio: ${err.message}`);
    }

    if (eventId) {
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'photo_sms_sent',
        metadata: { photoId },
      }).catch(() => {});
    }

    res.json({ success: true, message: 'SMS sent' });
  } catch (err) {
    console.error('SMS share error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /share/:code ─────────────────────────────────────────────────────────
// Resolve a short code to a gallery URL
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { data: photo } = await supabase
      .from('photos')
      .select('id, gallery_url')
      .eq('short_code', code)
      .single();

    if (!photo) return res.status(404).json({ error: 'Short link not found' });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
    const destination = photo.gallery_url || `${FRONTEND_URL}/gallery/${photo.id}`;

    res.redirect(302, destination);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
