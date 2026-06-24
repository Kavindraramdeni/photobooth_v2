/**
 * Email Service - Auto email delivery for photos
 * SendGrid integration for reliable email sending
 */

const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send photo email to guest
 */
async function sendPhotoEmail(email, name, photoUrl, event, shortCode) {
  try {
    if (!email || !photoUrl) {
      throw new Error('Email and photoUrl required');
    }

    const galleryUrl = `${process.env.NEXT_PUBLIC_APP_URL}/p/${shortCode}`;
    const eventName = event?.name || 'Photo Booth';
    const venue = event?.venue ? ` • ${event.venue}` : '';

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'photos@snapbooth.app',
      replyTo: event?.owner_email || 'support@snapbooth.app',
      subject: `Your ${eventName} Photo!`,
      html: generateEmailTemplate({
        name,
        photoUrl,
        galleryUrl,
        eventName,
        venue,
        eventLogo: event?.branding?.logo_url,
        eventColor: event?.branding?.primary_color || '#8B5CF6',
      }),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    };

    await sgMail.send(msg);

    return {
      success: true,
      messageId: msg.messageId,
      email,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send batch emails to all leads from event
 */
async function sendBatchEmails(eventId, leads, subject, templateId) {
  try {
    const results = [];

    for (const lead of leads) {
      try {
        const result = await sendPhotoEmail(
          lead.email,
          lead.name,
          lead.photo_url,
          { id: eventId },
          lead.short_code
        );
        results.push({ ...result, status: 'sent' });
      } catch (error) {
        results.push({
          email: lead.email,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      total: leads.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };
  } catch (error) {
    console.error('Batch email error:', error);
    throw error;
  }
}

/**
 * Generate beautiful email template
 */
function generateEmailTemplate({
  name,
  photoUrl,
  galleryUrl,
  eventName,
  venue,
  eventLogo,
  eventColor,
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; border-bottom: 2px solid ${eventColor}; }
          .header h1 { margin: 0; color: ${eventColor}; font-size: 24px; }
          .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
          .photo-box { margin: 30px 0; text-align: center; }
          .photo-box img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .content { margin: 30px 0; text-align: center; }
          .content p { margin: 0 0 15px 0; color: #333; font-size: 16px; line-height: 1.6; }
          .cta-button { display: inline-block; padding: 12px 30px; background-color: ${eventColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .cta-button:hover { opacity: 0.9; }
          .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px; }
          .footer a { color: ${eventColor}; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${eventLogo ? `<img src="${eventLogo}" alt="${eventName}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
            <h1>Your Photo from ${eventName}</h1>
            <p>${venue}</p>
          </div>

          <div class="photo-box">
            <img src="${photoUrl}" alt="Your photo" style="max-width: 100%; border-radius: 8px;">
          </div>

          <div class="content">
            <p>Hi ${name},</p>
            <p>We captured a great moment with you! Check out your photo and share it with friends.</p>
            <a href="${galleryUrl}" class="cta-button">View Your Photo</a>
            <p style="font-size: 12px; color: #999;">This photo will be available for 30 days</p>
          </div>

          <div class="footer">
            <p>Powered by <a href="https://snapbooth.app">SnapBooth</a></p>
            <p>Questions? <a href="mailto:support@snapbooth.app">Contact us</a></p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe">Unsubscribe</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

module.exports = {
  sendPhotoEmail,
  sendBatchEmails,
};
