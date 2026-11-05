const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { signToken } = require('../src/utils/token');
const { app } = require('../src/index');
const { applyBeautyMode } = require('../src/services/imageProcessor');

describe('CHALLENGER ADVERSARIAL SUITE — M1 Backend Routes & Socket.IO', () => {
  let ioBroadcasts = [];
  let originalIo = null;

  before(async () => {
    await startServer();

    // Intercept Socket.IO broadcasts
    const realIo = app.get('io');
    originalIo = realIo;
    const mockIo = {
      to: (room) => ({
        emit: (event, data) => {
          ioBroadcasts.push({ room, event, data });
          if (realIo && realIo.to) {
            try { realIo.to(room).emit(event, data); } catch (e) {}
          }
        },
      }),
    };
    app.set('io', mockIo);
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

  // =========================================================================
  // SECTION 1: PUT /api/events/:id — Socket.IO Broadcast & Credential Sanitization
  // =========================================================================
  describe('1. PUT /api/events/:id: Broadcast, Sanitization & Room Targeting', () => {
    const eventId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const ownerId = 'user-owner-123';
    const otherUserId = 'user-intruder-999';

    beforeEach(() => {
      state.events.push({
        id: eventId,
        name: 'Gala Night',
        slug: 'gala-night',
        status: 'active',
        owner_id: ownerId,
        operator_pin: '1234',
        gallery_password: 'super-secret-gallery-pass',
        branding: {
          primaryColor: '#000000',
          secondaryColor: '#ffffff',
          template: 'classic',
          footerText: 'SnapBooth Default',
        },
        settings: {
          countdownSeconds: 3,
          beautyLevel: 0,
          operatorPin: '1234',
          webhookSecret: 'whsec_ultra_confidential_999',
          galleryPassword: 'super-secret-gallery-pass',
          allowRetakes: true,
          allowAI: true,
        },
      });
    });

    it('emits to exact room event-${id} with event-updated and strips operatorPin, webhookSecret, galleryPassword', async () => {
      const updatePayload = {
        branding: {
          primaryColor: '#ff007f',
          secondaryColor: '#111111',
          template: 'polaroid',
          footerText: 'VIP Gala 2026',
        },
        settings: {
          countdownSeconds: 5,
          beautyLevel: 4,
          operatorPin: '9999',
          webhookSecret: 'whsec_new_super_secret',
          galleryPassword: 'new-gallery-password',
          allowAI: false,
          retakeLimit: 3,
        },
      };

      const res = await apiRequest(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer owner-token-${ownerId}` },
        body: updatePayload,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify broadcast presence
      assert.strictEqual(ioBroadcasts.length, 1, 'Exactly one Socket.IO broadcast should be emitted');
      const broadcast = ioBroadcasts[0];

      // Exact room check
      assert.strictEqual(broadcast.room, `event-${eventId}`, 'Must target room event-${id}');
      assert.strictEqual(broadcast.event, 'event-updated', 'Event name must be event-updated');

      // Payload validation
      const payload = broadcast.data;
      assert.strictEqual(payload.type, 'event-updated');
      assert.deepStrictEqual(payload.branding, updatePayload.branding);

      // Sanitization verification
      assert.strictEqual(payload.settings.countdownSeconds, 5);
      assert.strictEqual(payload.settings.beautyLevel, 4);
      assert.strictEqual(payload.settings.retakeLimit, 3);
      assert.strictEqual(payload.settings.allowAI, false);

      // SENSITIVE CREDENTIALS MUST BE STRICTLY UNDEFINED
      assert.strictEqual(payload.settings.operatorPin, undefined, 'operatorPin must be excluded from broadcast');
      assert.strictEqual(payload.settings.webhookSecret, undefined, 'webhookSecret must be excluded from broadcast');
      assert.strictEqual(payload.settings.galleryPassword, undefined, 'galleryPassword must be excluded from broadcast');

      // Top-level payload must NOT leak raw event columns
      assert.strictEqual(payload.operator_pin, undefined, 'operator_pin column must not be in broadcast payload');
      assert.strictEqual(payload.gallery_password, undefined, 'gallery_password column must not be in broadcast payload');
      assert.strictEqual(payload.owner_id, undefined, 'owner_id must not be in broadcast payload');
    });

    it('synchronizes operator_pin column when operatorPin is passed in settings or root body', async () => {
      // 1. Pass in settings
      const res1 = await apiRequest(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer owner-token-${ownerId}` },
        body: { settings: { operatorPin: '7788' } },
      });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.event.operator_pin, '7788');

      // 2. Pass in root body
      const res2 = await apiRequest(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer owner-token-${ownerId}` },
        body: { operator_pin: '5566' },
      });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.event.operator_pin, '5566');
    });

    it('does NOT broadcast when unauthenticated caller attempts PUT /api/events/:id', async () => {
      const res = await apiRequest(`/api/events/${eventId}`, {
        method: 'PUT',
        body: { branding: { primaryColor: '#ffffff' } },
      });

      assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
      assert.strictEqual(ioBroadcasts.length, 0, 'No broadcast should occur on unauthenticated request');
    });

    it('does NOT broadcast when unauthorized tenant attempts to update another tenant event', async () => {
      const res = await apiRequest(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer owner-token-${otherUserId}` },
        body: { branding: { primaryColor: '#ffffff' } },
      });

      assert.strictEqual(res.status, 404, 'Must return 404 when user does not own event');
      assert.strictEqual(ioBroadcasts.length, 0, 'No broadcast should occur on unauthorized tenant request');
    });

    it('does NOT broadcast when updating non-existent event ID', async () => {
      const res = await apiRequest(`/api/events/00000000-0000-0000-0000-000000000000`, {
        method: 'PUT',
        headers: { Authorization: `Bearer owner-token-${ownerId}` },
        body: { branding: { primaryColor: '#ffffff' } },
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(ioBroadcasts.length, 0, 'No broadcast should occur for non-existent event');
    });

    it('GET /api/events/:id sanitizes sensitive fields for public/booth callers and preserves them for owner', async () => {
      // Public caller (no auth)
      const publicRes = await apiRequest(`/api/events/${eventId}`);
      assert.strictEqual(publicRes.status, 200);
      const pubEvent = publicRes.body.event;
      assert.strictEqual(pubEvent.settings.operatorPin, undefined, 'Public GET must not leak operatorPin');
      assert.strictEqual(pubEvent.settings.webhookSecret, undefined, 'Public GET must not leak webhookSecret');
      assert.strictEqual(pubEvent.settings.galleryPassword, undefined, 'Public GET must not leak galleryPassword');
      assert.strictEqual(pubEvent.operator_pin, undefined, 'Public GET must not leak operator_pin');
      assert.strictEqual(pubEvent.hasGalleryPassword, true, 'Public GET indicates presence of password via boolean flag');

      // Owner caller
      const ownerRes = await apiRequest(`/api/events/${eventId}`, {
        headers: { Authorization: `Bearer owner-token-${ownerId}` },
      });
      assert.strictEqual(ownerRes.status, 200);
      const ownEvent = ownerRes.body.event;
      assert.strictEqual(ownEvent.settings.operatorPin, '1234', 'Owner GET preserves operatorPin');
      assert.strictEqual(ownEvent.settings.webhookSecret, 'whsec_ultra_confidential_999', 'Owner GET preserves webhookSecret');
    });
  });

  // =========================================================================
  // SECTION 2: Photo Upload & applyBeautyMode Pipeline Verification
  // =========================================================================
  describe('2. Photo Upload: Beauty Mode Ingestion Pipeline', () => {
    let testImageBuffer;

    before(async () => {
      // Create a deterministic 200x200 RGB test image
      testImageBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 240, g: 190, b: 170 },
        },
      }).jpeg({ quality: 95 }).toBuffer();
    });

    it('applyBeautyMode directly: returns identical buffer reference when level is 0', async () => {
      const res = await applyBeautyMode(testImageBuffer, 0);
      assert.strictEqual(res, testImageBuffer, 'Level 0 must return input buffer directly without re-processing');
    });

    it('applyBeautyMode directly: produces modified buffer when level > 0 and clamps properly', async () => {
      const smoothed = await applyBeautyMode(testImageBuffer, 5);
      assert.notStrictEqual(smoothed, testImageBuffer, 'Level 5 must return processed buffer');
      assert.ok(Buffer.isBuffer(smoothed));
      assert.notDeepStrictEqual(smoothed, testImageBuffer, 'Buffer content must differ due to smoothing');

      // Boundary: level > 10 is clamped without throwing
      const clamped = await applyBeautyMode(testImageBuffer, 50);
      assert.ok(Buffer.isBuffer(clamped));
    });

    it('upload pipeline: applies beauty mode when beautyLevel > 0', async () => {
      const eventId = 'b1b2b3b4-c5c6-d7d8-e9e0-f1f2f3f4f5f6';
      state.events.push({
        id: eventId,
        name: 'Beauty Active Event',
        slug: 'beauty-active-event',
        status: 'active',
        owner_id: 'user-owner',
        branding: null, // no branding overlay to test pure beauty mode
        settings: {
          beautyLevel: 7,
        },
      });

      const boothToken = signToken({ role: 'booth', eventId }, 3600);
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('photo', new Blob([testImageBuffer], { type: 'image/jpeg' }), 'portrait.jpg');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.photo.url);

      // Verify that stored image is different from raw resized image
      const rawResized = await sharp(testImageBuffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();

      const { storedFiles } = require('./helpers/testServer');
      const uploadedFile = storedFiles.get(res.body.photo.storage_key);
      assert.ok(uploadedFile, 'File must be stored');
      assert.notDeepStrictEqual(uploadedFile.buffer, rawResized, 'Uploaded buffer must have beauty mode applied');
    });

    it('upload pipeline: leaves buffer untouched by beauty mode when beautyLevel === 0', async () => {
      const eventId = 'c1c2c3c4-d5d6-e7e8-f9f0-a1a2a3a4a5a6';
      state.events.push({
        id: eventId,
        name: 'Beauty Disabled Event',
        slug: 'beauty-disabled-event',
        status: 'active',
        owner_id: 'user-owner',
        branding: null,
        settings: {
          beautyLevel: 0,
        },
      });

      const boothToken = signToken({ role: 'booth', eventId }, 3600);
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('photo', new Blob([testImageBuffer], { type: 'image/jpeg' }), 'portrait.jpg');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const rawResized = await sharp(testImageBuffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();

      const { storedFiles } = require('./helpers/testServer');
      const uploadedFile = storedFiles.get(res.body.photo.storage_key);
      assert.deepStrictEqual(uploadedFile.buffer, rawResized, 'Uploaded buffer must match raw resized buffer exactly when beautyLevel is 0');
    });

    it('upload pipeline: leaves buffer untouched when beautyLevel is undefined or negative', async () => {
      const eventId = 'd1d2d3d4-e5e6-f7f8-a9a0-b1b2b3b4b5b6';
      state.events.push({
        id: eventId,
        name: 'Beauty Undefined Event',
        slug: 'beauty-undefined-event',
        status: 'active',
        owner_id: 'user-owner',
        branding: null,
        settings: {
          // beautyLevel missing
        },
      });

      const boothToken = signToken({ role: 'booth', eventId }, 3600);
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('photo', new Blob([testImageBuffer], { type: 'image/jpeg' }), 'portrait.jpg');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formData,
      });

      assert.strictEqual(res.status, 200);

      const rawResized = await sharp(testImageBuffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();

      const { storedFiles } = require('./helpers/testServer');
      const uploadedFile = storedFiles.get(res.body.photo.storage_key);
      assert.deepStrictEqual(uploadedFile.buffer, rawResized, 'Uploaded buffer must match raw resized buffer when beautyLevel is undefined');
    });
  });

  // =========================================================================
  // SECTION 3: SMS Share Route & Custom Template Token Rendering
  // =========================================================================
  describe('3. POST /api/share/sms: Settings Loading & Template Token Rendering', () => {
    let capturedTwilioRequests = [];
    let originalFetch = null;

    before(() => {
      originalFetch = global.fetch;
      global.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('api.twilio.com')) {
          capturedTwilioRequests.push({ url, opts, bodyParams: new URLSearchParams(opts.body) });
          return {
            ok: true,
            status: 201,
            json: async () => ({ sid: 'SM_adversarial_test_sid' }),
            headers: new Headers({ 'content-type': 'application/json' }),
          };
        }
        return originalFetch(url, opts);
      };

      process.env.TWILIO_ACCOUNT_SID = 'AC_challenger_sid';
      process.env.TWILIO_AUTH_TOKEN = 'mock_auth_token';
      process.env.TWILIO_PHONE_NUMBER = '+18885550199';
    });

    after(() => {
      global.fetch = originalFetch;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    });

    beforeEach(() => {
      capturedTwilioRequests = [];
    });

    it('loads settings and renders custom SMS template tokens {url} and {event}', async () => {
      const eventId = 'e1e2e3e4-f5f6-a7a8-b9b0-c1c2c3c4c5c6';
      state.events.push({
        id: eventId,
        name: 'Starlight Gala',
        slug: 'starlight-gala',
        status: 'active',
        owner_id: 'user-owner',
        settings: {
          smsMessage: 'Hi from {event}! Your memories are ready: {url} 🎉',
        },
      });

      const photoId = 'f1f2f3f4-a5a6-b7b8-c9c0-d1d2d3d4d5d6';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        short_code: 'star01',
        url: 'https://mock-storage.snapbooth.test/star01.jpg',
        is_hidden: false,
      });

      const res = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: {
          photoId,
          phone: '+15551234567',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(capturedTwilioRequests.length, 1);

      const sentBody = capturedTwilioRequests[0].bodyParams.get('Body');
      assert.ok(sentBody.includes('Starlight Gala'), 'Must render {event} as Starlight Gala');
      assert.ok(!sentBody.includes('{event}'), 'Token {event} must be completely substituted');
      assert.ok(!sentBody.includes('{url}'), 'Token {url} must be completely substituted');
      assert.ok(sentBody.includes('/p/star01') || sentBody.includes('star01'), 'Must include photo short link');
    });

    it('falls back to default template when smsMessage is missing or empty in settings', async () => {
      const eventId = '11a2b3c4-22d3-33e4-44f5-55a6b7c8d9e0';
      state.events.push({
        id: eventId,
        name: 'Default Gala',
        slug: 'default-gala',
        status: 'active',
        owner_id: 'user-owner',
        settings: {
          smsMessage: null,
        },
      });

      const photoId = '22b3c4d5-33e4-44f5-55a6-66b7c8d9e0f1';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        short_code: 'def01',
        url: 'https://mock-storage.snapbooth.test/def01.jpg',
        is_hidden: false,
      });

      const res = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: {
          photoId,
          phone: '+15559876543',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedTwilioRequests.length, 1);
      const sentBody = capturedTwilioRequests[0].bodyParams.get('Body');
      assert.ok(sentBody.startsWith('📸 Default Gala — here\'s your photo! View & save:'), 'Must use default template');
    });

    it('rejects SMS request with 404 and does not call Twilio when photo is marked is_hidden', async () => {
      const eventId = '33c4d5e6-44f5-55a6-66b7-77c8d9e0f1a2';
      state.events.push({
        id: eventId,
        name: 'Hidden Event',
        slug: 'hidden-event',
        status: 'active',
        owner_id: 'user-owner',
        settings: { smsMessage: 'Photo: {url}' },
      });

      const photoId = '44d5e6f7-55a6-66b7-77c8-88d9e0f1a2b3';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        short_code: 'hide01',
        url: 'https://mock-storage.snapbooth.test/hide01.jpg',
        is_hidden: true, // Moderated / Hidden photo
      });

      const res = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: {
          photoId,
          phone: '+15551112222',
        },
      });

      assert.strictEqual(res.status, 404, 'Must return 404 for is_hidden photo');
      assert.strictEqual(capturedTwilioRequests.length, 0, 'Must NOT trigger Twilio SMS for hidden photo');
    });

    it('rejects SMS request with 400 when photoId or phone is missing', async () => {
      const res1 = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: { phone: '+15550001111' },
      });
      assert.strictEqual(res1.status, 400);

      const res2 = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: { photoId: 'some-id' },
      });
      assert.strictEqual(res2.status, 400);
      assert.strictEqual(capturedTwilioRequests.length, 0);
    });

    it('returns 503 Service Unavailable when Twilio env credentials are missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      const eventId = '55e6f7a8-66b7-77c8-88d9-99e0f1a2b3c4';
      state.events.push({
        id: eventId,
        name: 'Env Test Event',
        slug: 'env-test',
        status: 'active',
        owner_id: 'user-owner',
      });
      const photoId = '66f7a8b9-77c8-88d9-99e0-00f1a2b3c4d5';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        short_code: 'env01',
        url: 'https://mock-storage.snapbooth.test/env01.jpg',
        is_hidden: false,
      });

      const res = await apiRequest('/api/share/sms', {
        method: 'POST',
        body: {
          photoId,
          phone: '+15550009999',
        },
      });

      assert.strictEqual(res.status, 503, 'Must return 503 when Twilio credentials are missing');
      assert.strictEqual(capturedTwilioRequests.length, 0);

      // Restore for cleanup
      process.env.TWILIO_ACCOUNT_SID = 'AC_challenger_sid';
    });
  });
});
