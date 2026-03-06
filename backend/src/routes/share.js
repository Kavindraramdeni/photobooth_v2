/**
 * backend/src/routes/share.js  (FULL REPLACEMENT)
 *
 * Adds POST /api/share/email  — sends photo via Resend (free tier: 100 emails/day)
 * Adds POST /api/share/sms    — sends photo via Twilio (optional, needs TWILIO_* env vars)
 *
 * Env vars needed:
 *   RESEND_API_KEY=re_xxxxxxxxxxxx   (get free at resend.com)
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxx    (optional)
 *   TWILIO_AUTH_TOKEN=xxxxxxxx       (optional)
 *   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx (optional)
 *   FRONTEND_URL=https://photobooth-v2-xi.vercel.app
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl } = require('../services/sharing');

// ─── helpers ─────────────────────────────────────────────────────────────────

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app';
}

function buildPerPhotoUrl(eventSlug, photoId) {
  return `${frontendUrl()}/gallery/${photoId}`;
}

// ─── GET /api/share/:photoId ─ get sharing metadata ──────────────────────────

router.get('/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName = photo.events?.name || '';
    const galleryUrl = buildPerPhotoUrl(photo.events?.slug, photo.id);
    const qrCode = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photo.url, eventName);

    await supabase.from('analytics').insert({
      event_id: photo.event_id,
      action: 'photo_shared',
      metadata: { photoId: photo.id },
    });

    res.json({
      photo: {
        id: photo.id,
        url: photo.url,
        galleryUrl,
        qrCode,
        whatsappUrl,
        downloadUrl: photo.url,
        eventName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/share/email ─ send photo via Resend ───────────────────────────

router.post('/email', async (req, res) => {
  const { photoId, toEmail } = req.body;

  if (!photoId || !toEmail) {
    return res.status(400).json({ error: 'photoId and toEmail are required' });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug, branding)')
      .eq('id', photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName = photo.events?.name || 'SnapBooth';
    const photoUrl  = buildPerPhotoUrl(photo.events?.slug, photo.id);
    const downloadUrl = photo.url;
    const primaryColor = photo.events?.branding?.primaryColor || '#7c3aed';

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
    }

    // ── Send via Resend ──────────────────────────────────────────────────────
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${eventName} <photos@snapbooth.ai>`,  // must be a verified domain in Resend
        to: [toEmail],
        subject: `Your photo from ${eventName} 📸`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <h1 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 8px 0;text-align:center">
      Your Photo is Ready! 📸
    </h1>
    <p style="color:rgba(255,255,255,0.5);text-align:center;margin:0 0 32px 0">
      From ${eventName}
    </p>

    <div style="text-align:center;margin-bottom:32px">
      <img src="${photo.url}" alt="Your photobooth photo"
        style="max-width:100%;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5)" />
    </div>

    <div style="text-align:center;margin-bottom:16px">
      <a href="${photoUrl}"
        style="display:inline-block;padding:16px 40px;background:${primaryColor};
               color:#ffffff;text-decoration:none;border-radius:12px;
               font-weight:700;font-size:18px">
        View &amp; Save Your Photo
      </a>
    </div>

    <div style="text-align:center;margin-bottom:32px">
      <a href="${downloadUrl}"
        style="color:rgba(255,255,255,0.5);font-size:14px;text-decoration:underline">
        Direct download link
      </a>
    </div>

    <p style="color:rgba(255,255,255,0.2);font-size:12px;text-align:center;margin:0">
      Powered by SnapBooth AI &nbsp;·&nbsp; This photo will be available for 30 days
    </p>
  </div>
</body>
</html>`,
      }),
    });

    if (!emailResponse.ok) {
      const err = await emailResponse.text();
      console.error('Resend error:', err);
      return res.status(502).json({ error: 'Email send failed', detail: err });
    }

    // Track
    await supabase.from('analytics').insert({
      event_id: photo.event_id,
      action: 'photo_emailed',
      metadata: { photoId, toEmail },
    });

    res.json({ success: true, message: `Photo sent to ${toEmail}` });
  } catch (err) {
    console.error('/api/share/email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/share/sms ─ send photo link via Twilio ────────────────────────

router.post('/sms', async (req, res) => {
  const { photoId, toPhone } = req.body;

  if (!photoId || !toPhone) {
    return res.status(400).json({ error: 'photoId and toPhone are required' });
  }

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

    const eventName = photo.events?.name || 'SnapBooth';
    const photoUrl  = buildPerPhotoUrl(photo.events?.slug, photo.id);

    const body = `📸 ${eventName} — here's your photo! View & save: ${photoUrl}`;

    // Twilio REST API (no SDK needed)
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: toPhone,
          Body: body,
        }).toString(),
      }
    );

    if (!twilioRes.ok) {
      const err = await twilioRes.text();
      return res.status(502).json({ error: 'SMS send failed', detail: err });
    }

    await supabase.from('analytics').insert({
      event_id: photo.event_id,
      action: 'photo_sms_sent',
      metadata: { photoId, toPhone },
    });

    res.json({ success: true, message: `SMS sent to ${toPhone}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
