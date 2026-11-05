const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { sendPhotoEmail } = require('../src/services/email');

describe('Email Service Graceful Fallback (R4)', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('sendPhotoEmail logs to console with [EMAIL_FALLBACK] and returns fallback: true when API key is missing', async () => {
    delete process.env.SENDGRID_API_KEY;

    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const email = 'guest@example.com';
      const name = 'Guest Person';
      const photoUrl = 'https://mock-storage.snapbooth.test/events/evt-1/photos/photo-123_100.jpg';
      const event = { id: 'evt-1', name: 'Summer Wedding' };
      const shortCode = 'sum123';
      const photoId = 'photo-123';

      const result = await sendPhotoEmail(email, name, photoUrl, event, shortCode, photoId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.message, 'Logged to console (SendGrid API key not configured)');

      // Verify exact log format: [EMAIL_FALLBACK] To: <to>, ShareLink: <link>, PhotoId: <id>
      const fallbackLog = logs.find((l) => l.includes('[EMAIL_FALLBACK]'));
      assert.ok(fallbackLog, 'Must produce [EMAIL_FALLBACK] log');
      assert.ok(fallbackLog.includes('To: guest@example.com'));
      assert.ok(fallbackLog.includes('ShareLink: http://localhost:3000/p/sum123'));
      assert.ok(fallbackLog.includes('PhotoId: photo-123'));
    } finally {
      console.log = originalLog;
    }
  });

  it('POST /api/email/photo handles fallback gracefully returning 200 with fallback flag', async () => {
    delete process.env.SENDGRID_API_KEY;

    const eventId = 'evt-email-test';
    const photoId = 'photo-test-abc';

    state.events.push({
      id: eventId,
      name: 'Email Test Event',
      status: 'active',
    });

    state.photos.push({
      id: photoId,
      event_id: eventId,
      url: 'https://mock-storage.snapbooth.test/photo.jpg',
      short_code: 'sc123',
    });

    const res = await apiRequest('/api/email/photo', {
      method: 'POST',
      body: {
        photoId,
        email: 'recipient@example.com',
        name: 'Alex',
        eventId,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.fallback, true);

    // Verify lead was captured even in fallback mode
    assert.strictEqual(state.leads.length, 1);
    assert.strictEqual(state.leads[0].email, 'recipient@example.com');
  });

  it('POST /api/share/email handles fallback gracefully returning 200 with fallback flag', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;

    const eventId = 'evt-share-email';
    const photoId = 'photo-share-xyz';

    state.events.push({
      id: eventId,
      name: 'Share Test Event',
      slug: 'share-test',
      status: 'active',
    });

    state.photos.push({
      id: photoId,
      event_id: eventId,
      url: 'https://mock-storage.snapbooth.test/photo.jpg',
      short_code: 'share1',
    });

    const res = await apiRequest('/api/share/email', {
      method: 'POST',
      body: {
        photoId,
        toEmail: 'guest-share@example.com',
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.fallback, true);
  });
});
