/**
 * backend/src/routes/share.js
 *
 * POST /api/share/email  — sends branded HTML email via Resend (resend.com)
 * POST /api/share/sms    — sends SMS via Twilio
 *
 * Required env vars on Render:
 *   RESEND_API_KEY          — get free at resend.com (100 emails/day free)
 *   TWILIO_ACCOUNT_SID      — optional, for SMS
 *   TWILIO_AUTH_TOKEN       — optional
 *   TWILIO_PHONE_NUMBER     — optional (e.g. +14155552671)
 *   FRONTEND_URL            — https://photobooth-v2-xi.vercel.app
 *
 * Per-event operator settings (stored in events.settings JSON):
 *   allowEmailShare  boolean  default true
 *   allowSMSShare    boolean  default false
 *   emailFromName    string   e.g. "Sarah & Tom's Wedding"
 *   emailReplyTo     string   optional reply-to address
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../services/database');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl } = require('../services/sharing');

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
}

function buildPhotoPageUrl(photoId) {
  return `${frontendUrl()}/gallery/${photoId}`;
}

// ─── GET /api/share/:photoId ─ sharing metadata ───────────────────────────────
router.get('/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName  = photo.events?.name || '';
    const galleryUrl = buildPhotoPageUrl(photo.id);
    const qrCode     = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photo.url, eventName);

    await supabase.from('analytics').insert({
      event_id: photo.event_id,
      action: 'photo_shared',
      metadata: { photoId: photo.id },
    });

    res.json({
      photo: { id: photo.id, url: photo.url, galleryUrl, qrCode, whatsappUrl, downloadUrl: photo.url, eventName },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/share/email ────────────────────────────────────────────────────
router.post('/email', async (req, res) => {
  const { photoId, toEmail } = req.body;

  if (!photoId || !toEmail) return res.status(400).json({ error: 'photoId and toEmail are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) return res.status(400).json({ error: 'Invalid email address' });

  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug, branding, settings)')
      .eq('id', photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName    = photo.events?.name || 'SnapBooth';
    const settings     = photo.events?.settings || {};
    const primaryColor = photo.events?.branding?.primaryColor || '#7c3aed';
    const fromName     = settings.emailFromName || eventName;
    const replyTo      = settings.emailReplyTo  || null;
    const photoPageUrl = buildPhotoPageUrl(photo.id);

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
    }

    const emailBody = {
      from: `${fromName} <photos@snapbooth.ai>`,
      to:   [toEmail],
      subject: `Your photo from ${eventName} 📸`,
      ...(replyTo ? { reply_to: replyTo } : {}),
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <h1 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px;text-align:center">
      Your Photo is Ready! 📸
    </h1>
    <p style="color:rgba(255,255,255,0.5);text-align:center;margin:0 0 32px">From ${eventName}</p>
    <div style="text-align:center;margin-bottom:32px">
      <img src="${photo.url}" alt="Your photobooth photo"
        style="max-width:100%;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5)" />
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <a href="${photoPageUrl}"
        style="display:inline-block;padding:16px 40px;background:${primaryColor};color:#ffffff;
               text-decoration:none;border-radius:12px;font-weight:700;font-size:18px">
        View &amp; Save Your Photo
      </a>
    </div>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${photo.url}" style="color:rgba(255,255,255,0.5);font-size:14px;text-decoration:underline">
        Direct download link
      </a>
    </div>
    <p style="color:rgba(255,255,255,0.2);font-size:12px;text-align:center;margin:0">
      Powered by SnapBooth AI &nbsp;&middot;&nbsp; Photo available for 30 days
    </p>
  </div>
</body>
</html>`,
    };

    const r = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(emailBody),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend error:', detail);
      return res.status(502).json({ error: 'Email send failed', detail });
    }

    await supabase.from('analytics').insert({
      event_id: photo.event_id, action: 'photo_emailed', metadata: { photoId, toEmail },
    });

    res.json({ success: true, message: `Photo sent to ${toEmail}` });
  } catch (err) {
    console.error('/api/share/email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/share/sms ──────────────────────────────────────────────────────
router.post('/sms', async (req, res) => {
  const { photoId, toPhone } = req.body;

  if (!photoId || !toPhone) return res.status(400).json({ error: 'photoId and toPhone are required' });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return res.status(503).json({ error: 'SMS service not configured (TWILIO_* env vars missing)' });
  }

  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug)')
      .eq('id', photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName   = photo.events?.name || 'SnapBooth';
    const photoPageUrl = buildPhotoPageUrl(photo.id);
    const messageBody  = `📸 ${eventName} — here's your photo! View & save: ${photoPageUrl}`;

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: TWILIO_PHONE_NUMBER, To: toPhone, Body: messageBody }).toString(),
      }
    );

    if (!twilioRes.ok) {
      const detail = await twilioRes.text();
      console.error('Twilio error:', detail);
      return res.status(502).json({ error: 'SMS send failed', detail });
    }

    await supabase.from('analytics').insert({
      event_id: photo.event_id, action: 'photo_sms_sent', metadata: { photoId, toPhone },
    });

    res.json({ success: true, message: `SMS sent to ${toPhone}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
