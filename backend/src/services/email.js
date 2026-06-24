const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

function isEmailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function sendPhotoEmail({ to, subject, html, text, fromName, replyTo }) {
  if (!validateEmail(to)) throw new Error('A valid recipient email is required');
  if (!isEmailConfigured()) throw new Error('Email is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.');

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName || 'SnapBooth' },
    subject: subject || 'Your SnapBooth photo',
    content: [
      { type: 'text/plain', value: text || 'Your SnapBooth photo is ready.' },
      { type: 'text/html', value: html || '<p>Your SnapBooth photo is ready.</p>' },
    ],
  };

  if (replyTo && validateEmail(replyTo)) body.reply_to = { email: replyTo };

  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Unknown SendGrid error');
    throw new Error(`SendGrid failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return { success: true };
}

function buildPhotoEmail({ event, photo, message }) {
  const eventName = event?.branding?.eventName || event?.name || 'SnapBooth';
  const photoUrl = photo?.gallery_url || photo?.galleryUrl || photo?.url;
  const downloadUrl = photo?.url || photoUrl;
  const safeMessage = message || `Thanks for visiting ${eventName}! Your photo is ready.`;

  return {
    subject: event?.settings?.emailSubject || `Your photo from ${eventName}`,
    text: `${safeMessage}\n\nView your photo: ${photoUrl}\nDownload: ${downloadUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px">${eventName}</h2>
        <p>${safeMessage}</p>
        ${photo?.url ? `<p><img src="${photo.url}" alt="Your photo" style="max-width:100%;border-radius:16px" /></p>` : ''}
        <p><a href="${photoUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">View your photo</a></p>
        <p style="font-size:12px;color:#6b7280">Powered by SnapBooth</p>
      </div>
    `,
  };
}

module.exports = { sendPhotoEmail, buildPhotoEmail, isEmailConfigured, validateEmail };
