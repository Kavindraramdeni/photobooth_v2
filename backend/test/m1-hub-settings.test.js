const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { signToken } = require('../src/utils/token');
const { app } = require('../src/index');

describe('Milestone M1: Hub Settings, Operator PIN & Socket Broadcast', () => {
  let ioBroadcasts = [];
  let originalIo = null;

  before(async () => {
    await startServer();

    // Intercept Socket.IO broadcasts to verify event-updated events
    const realIo = app.get('io');
    originalIo = realIo;
    if (realIo) {
      const mockIo = {
        to: (room) => ({
          emit: (event, data) => {
            ioBroadcasts.push({ room, event, data });
            if (realIo.to) {
              try { realIo.to(room).emit(event, data); } catch (e) {}
            }
          },
        }),
      };
      app.set('io', mockIo);
    }
  });

  after(async () => {
    if (originalIo) {
      app.set('io', originalIo);
    }
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
    ioBroadcasts = [];
  });

  it('PUT /api/events/:id updates settings, operator_pin column, and broadcasts event-updated', async () => {
    const eventId = '11111111-2222-3333-4444-555555555555';
    state.events.push({
      id: eventId,
      name: 'Original Event',
      slug: 'original-event',
      status: 'active',
      owner_id: 'user-owner',
      operator_pin: '1234',
      branding: { primaryColor: '#000000', template: 'classic' },
      settings: {
        countdownSeconds: 3,
        beautyLevel: 0,
        operatorPin: '1234',
        webhookSecret: 'shhh-secret',
        galleryPassword: 'secret-pass',
      },
    });

    const updatePayload = {
      branding: {
        primaryColor: '#7c3aed',
        secondaryColor: '#ffffff',
        template: 'polaroid',
      },
      settings: {
        countdownSeconds: 5,
        beautyLevel: 4,
        operatorPin: '9876',
        webhookSecret: 'new-secret',
        galleryPassword: 'new-pass',
        allowRetakes: true,
      },
    };

    const res = await apiRequest(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: updatePayload,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.event.branding.primaryColor, '#7c3aed');
    assert.strictEqual(res.body.event.operator_pin, '9876');

    // Verify Socket.IO broadcast
    const broadcast = ioBroadcasts.find(b => b.room === `event-${eventId}` && b.event === 'event-updated');
    assert.ok(broadcast, 'Should have emitted event-updated to room event-${id}');
    assert.strictEqual(broadcast.data.type, 'event-updated');
    assert.strictEqual(broadcast.data.branding.primaryColor, '#7c3aed');
    assert.strictEqual(broadcast.data.settings.countdownSeconds, 5);
    assert.strictEqual(broadcast.data.settings.beautyLevel, 4);

    // Verify sensitive properties are stripped from broadcast
    assert.strictEqual(broadcast.data.settings.operatorPin, undefined);
    assert.strictEqual(broadcast.data.settings.webhookSecret, undefined);
    assert.strictEqual(broadcast.data.settings.galleryPassword, undefined);
  });

  it('POST /api/photos/upload applies beauty mode when beautyLevel > 0', async () => {
    const eventId = '22222222-3333-4444-5555-666666666666';
    state.events.push({
      id: eventId,
      name: 'Beauty Gala',
      slug: 'beauty-gala',
      status: 'active',
      owner_id: 'user-owner',
      branding: { primaryColor: '#7c3aed' },
      settings: {
        beautyLevel: 5,
        operatorPin: '1234',
      },
    });

    const boothToken = signToken({ role: 'booth', eventId }, 3600);

    // Create a simple valid 100x100 JPEG
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 200, b: 180 },
      },
    }).jpeg().toBuffer();

    const formData = new FormData();
    formData.append('eventId', eventId);
    const blob = new Blob([testImageBuffer], { type: 'image/jpeg' });
    formData.append('photo', blob, 'face.jpg');

    const res = await apiRequest('/api/photos/upload', {
      method: 'POST',
      headers: { 'X-Booth-Session': boothToken },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.photo.url);
  });

  it('POST /api/share/sms queries events with settings and uses custom smsMessage', async () => {
    const eventId = '33333333-4444-5555-6666-777777777777';
    state.events.push({
      id: eventId,
      name: 'SMS Gala',
      slug: 'sms-gala',
      status: 'active',
      owner_id: 'user-owner',
      settings: {
        smsMessage: 'Hello from {event}! Check out your photo: {url}',
      },
    });

    const photoId = '44444444-5555-6666-7777-888888888888';
    state.photos.push({
      id: photoId,
      event_id: eventId,
      short_code: 'smsgala1',
      url: 'https://mock-storage.snapbooth.test/photo.jpg',
      is_hidden: false,
    });

    // Mock TWILIO environment variables
    process.env.TWILIO_ACCOUNT_SID = 'AC_mock_twilio_sid';
    process.env.TWILIO_AUTH_TOKEN = 'mock_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+15555555555';

    // Mock fetch for twilio api call
    const originalFetch = global.fetch;
    let sentTwilioBody = null;
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.twilio.com')) {
        sentTwilioBody = opts.body;
        return {
          ok: true,
          status: 201,
          json: async () => ({ sid: 'SM_mock_message_sid' }),
          headers: new Headers({ 'content-type': 'application/json' }),
        };
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: {
          photoId,
          toPhone: '+19876543210',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(sentTwilioBody, 'Twilio API should have been called');
      const decodedBody = decodeURIComponent(sentTwilioBody.replace(/\+/g, ' '));
      assert.ok(decodedBody.includes('Hello from SMS Gala'), `Expected body to contain custom SMS message, got: ${decodedBody}`);
    } finally {
      global.fetch = originalFetch;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    }
  });
});
