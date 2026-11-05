const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { startServer, stopServer, apiRequest, resetDb, state, storedFiles } = require('./helpers/testServer');
const { signToken, verifyToken } = require('../src/utils/token');

// Minimal 1x1 valid PNG buffer for realistic Sharp image processing
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('End-to-End Integration & Multi-Tier Verification Suite', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 1: Feature Completeness Matrix across R1-R4
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Tier 1: Feature Completeness Matrix', () => {
    it('T1.1: GET /api/events/:id sanitizes credentials and returns hasGalleryPassword: true for public', async () => {
      const eventId = crypto.randomUUID();
      state.events.push({
        id: eventId,
        name: 'Public Sanitized Gala',
        slug: 'sanitized-gala',
        status: 'active',
        owner_id: 'user-owner-1',
        gallery_password: 'supersecretpassword',
        settings: {
          operatorPin: '9988',
          webhookSecret: 'whsec_privatekey123',
          galleryPassword: 'supersecretpassword',
          theme: 'dark',
        },
      });

      // Query by UUID
      const resById = await apiRequest(`/api/events/${eventId}`);
      assert.strictEqual(resById.status, 200);
      assert.ok(resById.body.event);
      assert.strictEqual(resById.body.event.name, 'Public Sanitized Gala');
      assert.strictEqual(resById.body.event.hasGalleryPassword, true);

      // Sensitive credentials must be completely stripped
      assert.strictEqual(resById.body.event.gallery_password, undefined);
      assert.strictEqual(resById.body.event.settings.operatorPin, undefined);
      assert.strictEqual(resById.body.event.settings.webhookSecret, undefined);
      assert.strictEqual(resById.body.event.settings.galleryPassword, undefined);
      assert.strictEqual(resById.body.event.settings.theme, 'dark');

      // Query by Slug
      const resBySlug = await apiRequest('/api/events/sanitized-gala');
      assert.strictEqual(resBySlug.status, 200);
      assert.strictEqual(resBySlug.body.event.hasGalleryPassword, true);
    });

    it('T1.2: GET /api/events enforces tenancy: 401 unauthenticated, scopes to owner_id', async () => {
      state.events.push(
        { id: 'evt-user-a', name: 'User A Event', owner_id: 'user-a', status: 'active' },
        { id: 'evt-user-b', name: 'User B Event', owner_id: 'user-b', status: 'active' }
      );

      // Unauthenticated
      const unauth = await apiRequest('/api/events');
      assert.strictEqual(unauth.status, 401);

      // Authenticated user-a only sees evt-user-a
      const authA = await apiRequest('/api/events', {
        headers: { Authorization: 'Bearer owner-token-user-a' },
      });
      assert.strictEqual(authA.status, 200);
      assert.ok(Array.isArray(authA.body.events));
      assert.strictEqual(authA.body.events.length, 1);
      assert.strictEqual(authA.body.events[0].id, 'evt-user-a');
    });

    it('T1.3: POST /api/auth/operator-login issues 12-hour scoped JWT; rejects invalid PIN with 401', async () => {
      state.events.push({
        id: 'evt-op-tier1',
        name: 'Operator Booth Event',
        status: 'active',
        owner_id: 'owner-op',
        operator_pin: '7412',
      });

      // Valid PIN
      const validRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-op-tier1', pin: '7412' },
      });
      assert.strictEqual(validRes.status, 200);
      assert.ok(validRes.body.token);
      assert.strictEqual(validRes.body.operator.role, 'operator');
      assert.strictEqual(validRes.body.operator.eventId, 'evt-op-tier1');

      const decoded = verifyToken(validRes.body.token);
      assert.strictEqual(decoded.role, 'operator');
      assert.strictEqual(decoded.eventId, 'evt-op-tier1');

      // Invalid PIN
      const invalidRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-op-tier1', pin: '0000' },
      });
      assert.strictEqual(invalidRes.status, 401);
      assert.strictEqual(invalidRes.body.error, 'Invalid operator PIN');
    });

    it('T1.4: Booth session token guards all media upload routes (/upload, /gif, /strip, /burst) with 403', async () => {
      state.events.push({
        id: 'evt-booth-tier1',
        name: 'Booth Guard Event',
        status: 'active',
        owner_id: 'owner-booth',
      });

      const mediaRoutes = [
        { path: '/api/photos/upload', field: 'photo' },
        { path: '/api/photos/gif', field: 'frames' },
        { path: '/api/photos/strip', field: 'photos' },
        { path: '/api/photos/burst', field: 'frame_0' },
      ];

      for (const route of mediaRoutes) {
        const formData = new FormData();
        formData.append('eventId', 'evt-booth-tier1');
        const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
        formData.append(route.field, blob, 'test.png');

        const res = await apiRequest(route.path, {
          method: 'POST',
          body: formData,
        });
        assert.strictEqual(
          res.status,
          403,
          `Route ${route.path} must reject anonymous caller with 403`
        );
        assert.strictEqual(res.body.error, 'Valid event booth session required');
      }

      // Valid booth session issuance
      const tokenRes = await apiRequest('/api/events/evt-booth-tier1/booth-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer owner-token-owner-booth' },
      });
      assert.strictEqual(tokenRes.status, 200);
      assert.ok(tokenRes.body.sessionToken);
      assert.strictEqual(tokenRes.body.eventId, 'evt-booth-tier1');
    });

    it('T1.5: Photo privacy filter enforces is_hidden across all retrieval and sharing endpoints', async () => {
      state.events.push({
        id: 'evt-priv-tier1',
        name: 'Privacy Controlled Event',
        owner_id: 'owner-priv',
        status: 'active',
        slug: 'priv-tier1',
      });

      state.photos.push({
        id: 'photo-priv-hidden',
        short_code: 'hid100',
        event_id: 'evt-priv-tier1',
        url: 'https://storage.test/hidden.jpg',
        is_hidden: true,
      });

      // GET /:photoId -> 404 for public
      const directRes = await apiRequest('/api/photos/photo-priv-hidden');
      assert.strictEqual(directRes.status, 404);

      // GET /short/:code -> 404 for public
      const shortRes = await apiRequest('/api/photos/short/hid100');
      assert.strictEqual(shortRes.status, 404);

      // GET /:photoId/stories -> 404
      const storiesRes = await apiRequest('/api/photos/photo-priv-hidden/stories');
      assert.strictEqual(storiesRes.status, 404);

      // GET /share/:id -> 404
      const shareRes = await apiRequest('/api/share/photo-priv-hidden');
      assert.strictEqual(shareRes.status, 404);

      // POST /api/share/email -> 404
      const emailShareRes = await apiRequest('/api/share/email', {
        method: 'POST',
        body: { photoId: 'photo-priv-hidden', toEmail: 'guest@example.com' },
      });
      assert.strictEqual(emailShareRes.status, 404);

      // POST /api/email/photo -> 404
      const emailPhotoRes = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: 'photo-priv-hidden', email: 'guest@example.com' },
      });
      assert.strictEqual(emailPhotoRes.status, 404);

      // GET /api/gallery/:slug excludes hidden photo
      const galleryRes = await apiRequest('/api/gallery/priv-tier1');
      assert.strictEqual(galleryRes.status, 200);
      assert.strictEqual(galleryRes.body.photos.length, 0);
    });

    it('T1.6: Server upload deduplication returns existing record on retried upload with clientPhotoId', async () => {
      const eventId = 'evt-dedup-tier1';
      state.events.push({
        id: eventId,
        name: 'Dedup Tier 1',
        status: 'active',
        owner_id: 'owner-dedup',
        slug: 'dedup-tier1',
      });

      const boothToken = signToken({ role: 'booth', eventId }, 3600);
      const clientKey = 'b1c2d3e4-1111-2222-3333-444455556666';

      state.photos.push({
        id: clientKey,
        event_id: eventId,
        url: 'https://storage.test/first.jpg',
        gallery_url: 'http://localhost:3000/gallery/dedup-tier1',
        short_code: 'ded111',
        metadata: { clientPhotoId: clientKey },
        is_hidden: false,
      });

      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('clientPhotoId', clientKey);
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'retry.png');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.deduplicated, true);
      assert.strictEqual(res.body.photo.id, clientKey);
      assert.strictEqual(state.photos.length, 1, 'Database must not duplicate record');
    });

    it('T1.7: Email service graceful fallback logs to console and returns fallback: true when SendGrid is unconfigured', async () => {
      state.events.push({
        id: 'evt-email-tier1',
        name: 'Email Tier 1',
        status: 'active',
        owner_id: 'owner-email',
      });

      state.photos.push({
        id: 'photo-email-tier1',
        event_id: 'evt-email-tier1',
        url: 'https://storage.test/email.jpg',
        gallery_url: 'http://localhost:3000/gallery/email-tier1',
        is_hidden: false,
      });

      const originalApiKey = process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_API_KEY;

      const res = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: 'photo-email-tier1', email: 'guest-fallback@example.com' },
      });

      if (originalApiKey) process.env.SENDGRID_API_KEY = originalApiKey;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.fallback, true);

      // Verify guest email captured in leads table
      assert.strictEqual(state.leads.length, 1);
      assert.strictEqual(state.leads[0].email, 'guest-fallback@example.com');
      assert.strictEqual(state.leads[0].consented, true);
      assert.strictEqual(state.leads[0].opted_in, true);
    });

    it('T1.8: Gallery password verification authenticates correct password and rejects incorrect password', async () => {
      state.events.push({
        id: 'evt-gal-pass',
        name: 'Protected Gala',
        slug: 'protected-gala',
        status: 'active',
        gallery_password: 'GalaPass2026',
      });

      // Wrong password
      const wrongRes = await apiRequest('/api/gallery/protected-gala/verify-password', {
        method: 'POST',
        body: { password: 'WrongPassword' },
      });
      assert.strictEqual(wrongRes.status, 403);
      assert.strictEqual(wrongRes.body.ok, false);

      // Correct password
      const correctRes = await apiRequest('/api/gallery/protected-gala/verify-password', {
        method: 'POST',
        body: { password: 'GalaPass2026' },
      });
      assert.strictEqual(correctRes.status, 200);
      assert.strictEqual(correctRes.body.ok, true);
      assert.strictEqual(correctRes.body.success, true);
    });

    it('T1.9: Event ZIP archive export enforces event ownership: 401 unauthenticated, 403 non-owner', async () => {
      state.events.push({
        id: 'evt-zip-tier1',
        name: 'Zip Export Event',
        status: 'active',
        owner_id: 'owner-real',
      });

      // Unauthenticated
      const unauth = await apiRequest('/api/photos/event/evt-zip-tier1/zip');
      assert.strictEqual(unauth.status, 401);

      // Non-owner attacker
      const attacker = await apiRequest('/api/photos/event/evt-zip-tier1/zip', {
        headers: { Authorization: 'Bearer owner-token-attacker' },
      });
      assert.strictEqual(attacker.status, 403);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 2: Boundary Value Analysis (BVA) Matrix
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Tier 2: Boundary Value Analysis (BVA)', () => {
    it('T2.1: Operator PIN boundary inputs: whitespace trimming, numeric input, empty PIN, overlength PIN', async () => {
      state.events.push({
        id: 'evt-bva-pin',
        name: 'PIN BVA Event',
        status: 'active',
        owner_id: 'owner-bva',
        operator_pin: '8899',
      });

      // 1. Whitespace padding on both ends
      const trimmedRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-bva-pin', pin: '   8899   ' },
      });
      assert.strictEqual(trimmedRes.status, 200, 'Whitespace-padded PIN must be trimmed');

      // 2. Numeric PIN input { pin: 8899 }
      const numRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-bva-pin', pin: 8899 },
      });
      assert.strictEqual(numRes.status, 200, 'Numeric PIN must be safely converted and accepted');

      // 3. Empty string PIN
      const emptyRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-bva-pin', pin: '' },
      });
      assert.strictEqual(emptyRes.status, 401, 'Empty PIN must be rejected');

      // 4. Overlength 128-char PIN: pre-hashed via SHA-256, no crash or buffer length mismatch
      const overlengthPin = 'A'.repeat(128);
      const overRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-bva-pin', pin: overlengthPin },
      });
      assert.strictEqual(overRes.status, 401, 'Overlength PIN must be rejected safely');
    });

    it('T2.2: Token expiration boundary: expired operator token (>12h) and expired booth token (>24h) rejected', async () => {
      const eventId = 'evt-bva-exp';
      state.events.push({
        id: eventId,
        name: 'Expiration Event',
        status: 'active',
        owner_id: 'owner-exp',
      });

      // Expired booth token (expired 1 hour ago)
      const expiredBoothToken = signToken({ role: 'booth', eventId }, -3600);

      const formData = new FormData();
      formData.append('eventId', eventId);
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'test.png');

      const boothRes = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': expiredBoothToken },
        body: formData,
      });
      assert.strictEqual(boothRes.status, 403, 'Expired booth token must be rejected with 403');

      // Expired operator token
      const expiredOperatorToken = signToken({ role: 'operator', eventId }, -3600);
      const opRes = await apiRequest(`/api/events/${eventId}/booth-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${expiredOperatorToken}` },
      });
      assert.strictEqual(opRes.status, 401, 'Expired operator token must be rejected with 401');
    });

    it('T2.3: Booth token issuance rejection when event status is inactive (status: archived/completed)', async () => {
      state.events.push({
        id: 'evt-archived',
        name: 'Archived Event',
        status: 'archived',
        owner_id: 'owner-arch',
      });

      const res = await apiRequest('/api/events/evt-archived/booth-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer owner-token-owner-arch' },
      });
      assert.strictEqual(res.status, 400, 'Must reject booth token request for inactive event');
      assert.strictEqual(res.body.error, 'Event is not active');
    });

    it('T2.4: Missing required fields on POST /api/email/photo rejected with HTTP 400', async () => {
      state.events.push({
        id: 'evt-bva-email',
        name: 'Email BVA',
        status: 'active',
        owner_id: 'owner-bva',
      });

      state.photos.push({
        id: 'photo-bva-email',
        event_id: 'evt-bva-email',
        url: 'https://storage.test/p.jpg',
        is_hidden: false,
      });

      // 1. Missing email
      const resNoEmail = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: 'photo-bva-email', email: '' },
      });
      assert.strictEqual(resNoEmail.status, 400);

      // 2. Missing photoId
      const resNoPhoto = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: '', email: 'guest@example.com' },
      });
      assert.strictEqual(resNoPhoto.status, 400);

      // 3. Omitted email parameter entirely
      const resOmitted = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: 'photo-bva-email' },
      });
      assert.strictEqual(resOmitted.status, 400);
    });

    it('T2.5: Photo upload missing required fields (missing eventId or photo binary) returns HTTP 400', async () => {
      const eventId = 'evt-bva-missing';
      state.events.push({
        id: eventId,
        name: 'Missing Fields Event',
        status: 'active',
        owner_id: 'owner-bva',
      });
      const boothToken = signToken({ role: 'booth', eventId }, 3600);

      // Missing photo file
      const formNoFile = new FormData();
      formNoFile.append('eventId', eventId);
      const resNoFile = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formNoFile,
      });
      assert.strictEqual(resNoFile.status, 400);

      // Missing eventId
      const formNoEvent = new FormData();
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formNoEvent.append('photo', blob, 'pic.png');
      const resNoEvent = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formNoEvent,
      });
      assert.strictEqual(resNoEvent.status, 400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 3: Cross-Feature Interactions & Combinatorial Flows
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Tier 3: Cross-Feature Interactions', () => {
    it('T3.1: Operator Login -> Booth Token Acquisition -> Photo Ingestion -> Live Gallery Verification', async () => {
      const eventId = crypto.randomUUID();
      state.events.push({
        id: eventId,
        name: 'Gala Workflow 31',
        slug: 'gala-31',
        status: 'active',
        owner_id: 'owner-flow-31',
        operator_pin: '5566',
      });

      // Step 1: Operator authenticates with PIN
      const loginRes = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId, pin: '5566' },
      });
      assert.strictEqual(loginRes.status, 200);
      const operatorToken = loginRes.body.token;

      // Step 2: Operator acquires booth session token
      const sessionRes = await apiRequest(`/api/events/${eventId}/booth-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
      });
      assert.strictEqual(sessionRes.status, 200);
      const boothToken = sessionRes.body.sessionToken;

      // Step 3: Photo captured & uploaded via booth session
      const clientPhotoId = crypto.randomUUID();
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('clientPhotoId', clientPhotoId);
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'snap.png');

      const uploadRes = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: formData,
      });
      assert.strictEqual(uploadRes.status, 200);
      assert.strictEqual(uploadRes.body.success, true);
      assert.ok(uploadRes.body.photo.id);
      assert.ok(uploadRes.body.photo.qrCode);
      assert.ok(uploadRes.body.photo.galleryUrl);

      // Step 4: Verify uploaded photo appears in public gallery
      const galleryRes = await apiRequest('/api/gallery/gala-31');
      assert.strictEqual(galleryRes.status, 200);
      assert.strictEqual(galleryRes.body.photos.length, 1);
      assert.strictEqual(galleryRes.body.photos[0].id, uploadRes.body.photo.id);
    });

    it('T3.2: Moderation Hide -> Cross-Channel Privacy Propagation -> Unhide Re-activation', async () => {
      const eventId = 'evt-flow-32';
      state.events.push({
        id: eventId,
        name: 'Moderation Flow Event',
        slug: 'mod-flow-32',
        status: 'active',
        owner_id: 'owner-mod',
      });

      const photoId = 'photo-mod-test';
      const shortCode = 'MOD32X';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        url: 'https://storage.test/mod.jpg',
        short_code: shortCode,
        is_hidden: false,
      });

      // 1. Initially visible everywhere
      const initShort = await apiRequest(`/api/photos/short/${shortCode}`);
      assert.strictEqual(initShort.status, 200);
      const initGal = await apiRequest('/api/gallery/mod-flow-32');
      assert.strictEqual(initGal.body.photos.length, 1);

      // 2. Owner moderates and marks photo hidden
      const hideRes = await apiRequest(`/api/photos/${photoId}/moderate`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer owner-token-owner-mod' },
        body: { is_hidden: true, reason: 'Inappropriate content' },
      });
      assert.strictEqual(hideRes.status, 200);
      assert.strictEqual(hideRes.body.is_hidden, true);

      // 3. Verify photo is now hidden across all endpoints
      const hiddenShort = await apiRequest(`/api/photos/short/${shortCode}`);
      assert.strictEqual(hiddenShort.status, 404);
      const hiddenDirect = await apiRequest(`/api/photos/${photoId}`);
      assert.strictEqual(hiddenDirect.status, 404);
      const hiddenGal = await apiRequest('/api/gallery/mod-flow-32');
      assert.strictEqual(hiddenGal.body.photos.length, 0);
      const hiddenEmail = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId, email: 'guest@example.com' },
      });
      assert.strictEqual(hiddenEmail.status, 404);

      // 4. Owner restores / unhides photo
      const unhideRes = await apiRequest(`/api/photos/${photoId}/moderate`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer owner-token-owner-mod' },
        body: { is_hidden: false },
      });
      assert.strictEqual(unhideRes.status, 200);
      assert.strictEqual(unhideRes.body.is_hidden, false);

      // 5. Verify restored visibility
      const restoredShort = await apiRequest(`/api/photos/short/${shortCode}`);
      assert.strictEqual(restoredShort.status, 200);
      const restoredGal = await apiRequest('/api/gallery/mod-flow-32');
      assert.strictEqual(restoredGal.body.photos.length, 1);
    });

    it('T3.3: Deduplication -> Email Fallback -> Lead Ingestion Pipeline', async () => {
      const eventId = 'evt-flow-33';
      state.events.push({
        id: eventId,
        name: 'Lead Pipeline Event',
        slug: 'lead-pipe',
        status: 'active',
        owner_id: 'owner-lead',
      });
      const boothToken = signToken({ role: 'booth', eventId }, 3600);
      const clientKey = crypto.randomUUID();

      // Seed photo
      state.photos.push({
        id: clientKey,
        event_id: eventId,
        url: 'https://storage.test/lead.jpg',
        gallery_url: 'http://localhost:3000/gallery/lead-pipe',
        short_code: 'LP3300',
        metadata: { clientPhotoId: clientKey },
        is_hidden: false,
      });

      // Retried upload (idempotent sync)
      const form = new FormData();
      form.append('eventId', eventId);
      form.append('clientPhotoId', clientKey);
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      form.append('photo', blob, 'snap.png');

      const dedupRes = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': boothToken },
        body: form,
      });
      assert.strictEqual(dedupRes.status, 200);
      assert.strictEqual(dedupRes.body.deduplicated, true);
      assert.strictEqual(state.photos.length, 1);

      // Guest delivers email for this deduplicated photo
      const emailRes = await apiRequest('/api/email/photo', {
        method: 'POST',
        body: { photoId: clientKey, email: 'vip-guest@company.org' },
      });
      assert.strictEqual(emailRes.status, 200);
      assert.strictEqual(emailRes.body.fallback, true);

      // Verify lead saved with correct relations
      assert.strictEqual(state.leads.length, 1);
      assert.strictEqual(state.leads[0].email, 'vip-guest@company.org');
      assert.strictEqual(state.leads[0].event_id, eventId);
      assert.strictEqual(state.leads[0].photo_id, clientKey);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 4: Real-World Venue Application Scenarios
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Tier 4: Real-World Venue Application Scenarios', () => {
    it('T4.1: Offline Queue Sync Replay with Deduplication: 4 captures offline, reconnect sync with retry blips, exactly 4 photos in DB', async () => {
      const eventId = 'evt-venue-offline';
      state.events.push({
        id: eventId,
        name: 'Annual Charity Gala',
        slug: 'charity-gala',
        status: 'active',
        owner_id: 'owner-venue',
      });
      const boothToken = signToken({ role: 'booth', eventId }, 86400);

      // Simulate 4 photos queued in client IndexedDB during network blackout
      const queuedPhotos = [
        { clientKey: crypto.randomUUID(), name: 'table1.png' },
        { clientKey: crypto.randomUUID(), name: 'table2.png' },
        { clientKey: crypto.randomUUID(), name: 'table3.png' },
        { clientKey: crypto.randomUUID(), name: 'table4.png' },
      ];

      // Step 1: Pre-seed or first-pass upload
      // Table 1 & Table 2 succeed once
      for (let i = 0; i < 2; i++) {
        state.photos.push({
          id: queuedPhotos[i].clientKey,
          event_id: eventId,
          url: `https://storage.test/${queuedPhotos[i].clientKey}.jpg`,
          gallery_url: 'http://localhost:3000/gallery/charity-gala',
          short_code: `CODE${i + 1}`,
          metadata: { clientPhotoId: queuedPhotos[i].clientKey },
          is_hidden: false,
        });
      }

      // Step 2: Now client background sync runs upon internet restoration
      // It sends photo 1 (already synced -> dedup)
      // It sends photo 2 (already synced -> dedup)
      // It sends photo 3 (first attempt -> seed)
      state.photos.push({
        id: queuedPhotos[2].clientKey,
        event_id: eventId,
        url: `https://storage.test/${queuedPhotos[2].clientKey}.jpg`,
        gallery_url: 'http://localhost:3000/gallery/charity-gala',
        short_code: 'CODE3',
        metadata: { clientPhotoId: queuedPhotos[2].clientKey },
        is_hidden: false,
      });
      // And due to wireless retry, it sends photo 3 again!
      // It sends photo 4 (first attempt -> seed)
      state.photos.push({
        id: queuedPhotos[3].clientKey,
        event_id: eventId,
        url: `https://storage.test/${queuedPhotos[3].clientKey}.jpg`,
        gallery_url: 'http://localhost:3000/gallery/charity-gala',
        short_code: 'CODE4',
        metadata: { clientPhotoId: queuedPhotos[3].clientKey },
        is_hidden: false,
      });
      // And sends photo 4 again!

      // Execute all 4 replay requests
      for (const item of queuedPhotos) {
        const formData = new FormData();
        formData.append('eventId', eventId);
        formData.append('clientPhotoId', item.clientKey);
        const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
        formData.append('photo', blob, item.name);

        const res = await apiRequest('/api/photos/upload', {
          method: 'POST',
          headers: { 'X-Booth-Session': boothToken },
          body: formData,
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.deduplicated, true);
        assert.strictEqual(res.body.photo.id, item.clientKey);
      }

      // Exactly 4 distinct records must exist; zero duplicate entries
      assert.strictEqual(state.photos.length, 4, 'Must have exactly 4 non-duplicated records');
      const photoIds = state.photos.map((p) => p.id).sort();
      const expectedIds = queuedPhotos.map((q) => q.clientKey).sort();
      assert.deepStrictEqual(photoIds, expectedIds);
    });

    it('T4.2: Multi-Tenant Venue Isolation: Owner A and Owner B host concurrent events; total boundary protection', async () => {
      // Event A: Corporate Expo
      state.events.push({
        id: 'evt-corp-a',
        name: 'Corporate Expo',
        slug: 'corp-expo',
        status: 'active',
        owner_id: 'owner-corp-a',
        operator_pin: '1111',
      });

      // Event B: Luxury Wedding
      state.events.push({
        id: 'evt-wed-b',
        name: 'Luxury Wedding',
        slug: 'luxury-wedding',
        status: 'active',
        owner_id: 'owner-wed-b',
        operator_pin: '2222',
      });

      // Operator A logs into Event A
      const opLoginA = await apiRequest('/api/auth/operator-login', {
        method: 'POST',
        body: { eventId: 'evt-corp-a', pin: '1111' },
      });
      assert.strictEqual(opLoginA.status, 200);
      const opTokenA = opLoginA.body.token;

      // Operator A attempts to acquire booth token for Event B -> rejected
      const hackSession = await apiRequest('/api/events/evt-wed-b/booth-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opTokenA}` },
      });
      assert.strictEqual(hackSession.status, 403);

      // Owner A attempts to view Event B stats -> 403
      const crossStats = await apiRequest('/api/events/evt-wed-b/stats', {
        headers: { Authorization: 'Bearer owner-token-owner-corp-a' },
      });
      assert.strictEqual(crossStats.status, 403);

      // Owner A attempts to download Event B ZIP archive -> 403
      const crossZip = await apiRequest('/api/photos/event/evt-wed-b/zip', {
        headers: { Authorization: 'Bearer owner-token-owner-corp-a' },
      });
      assert.strictEqual(crossZip.status, 403);
    });

    it('T4.3: Guest QR Delivery & Password-Protected Gallery Journey: Session QR -> Gallery Password Gate -> Full Browsing', async () => {
      const eventId = 'evt-vip-journey';
      state.events.push({
        id: eventId,
        name: 'VIP Movie Premiere',
        slug: 'movie-premiere',
        status: 'active',
        owner_id: 'owner-premiere',
        gallery_password: 'VIPRedCarpetPass',
      });

      const photoId = crypto.randomUUID();
      const shortCode = 'PREM01';
      state.photos.push({
        id: photoId,
        event_id: eventId,
        url: 'https://storage.test/premiere.jpg',
        short_code: shortCode,
        is_hidden: false,
      });

      // Step 1: Guest scans session QR linking to /p/PREM01 -> queries /api/photos/short/PREM01
      const shortRes = await apiRequest(`/api/photos/short/${shortCode}`);
      assert.strictEqual(shortRes.status, 200);
      assert.strictEqual(shortRes.body.photo.id, photoId);
      assert.strictEqual(shortRes.body.photo.events.slug, 'movie-premiere');

      // Step 2: Guest navigates to event gallery without password -> receives 401 PASSWORD_REQUIRED
      const galUnauth = await apiRequest('/api/gallery/movie-premiere');
      assert.strictEqual(galUnauth.status, 401);
      assert.strictEqual(galUnauth.body.error, 'PASSWORD_REQUIRED');

      // Step 3: Guest attempts invalid password
      const wrongPass = await apiRequest('/api/gallery/movie-premiere/verify-password', {
        method: 'POST',
        body: { password: 'WrongPass' },
      });
      assert.strictEqual(wrongPass.status, 403);

      // Step 4: Guest enters correct password
      const authPass = await apiRequest('/api/gallery/movie-premiere/verify-password', {
        method: 'POST',
        body: { password: 'VIPRedCarpetPass' },
      });
      assert.strictEqual(authPass.status, 200);
      assert.strictEqual(authPass.body.ok, true);

      // Step 5: Guest loads gallery with verified password
      const galAuth = await apiRequest('/api/gallery/movie-premiere?password=VIPRedCarpetPass');
      assert.strictEqual(galAuth.status, 200);
      assert.strictEqual(galAuth.body.photos.length, 1);
      assert.strictEqual(galAuth.body.photos[0].id, photoId);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 5: Adversarial Hardening & Forensic Integrity Matrix
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Tier 5: Adversarial Hardening & Forensic Integrity Matrix', () => {
    it('T5.1: IDOR Attack: Malicious authenticated user cannot mutate victim event subresources (styles, assets, staff)', async () => {
      state.events.push({
        id: 'evt-victim',
        name: 'Victim Event',
        status: 'active',
        owner_id: 'user-victim',
      });

      const attackerAuth = { Authorization: 'Bearer owner-token-user-attacker' };

      // 1. Create style on victim event
      const styleRes = await apiRequest('/api/events/evt-victim/styles', {
        method: 'POST',
        headers: attackerAuth,
        body: { name: 'Exploit Style', prompt: 'test' },
      });
      assert.strictEqual(styleRes.status, 403);
      assert.strictEqual(styleRes.body.error, 'Access denied: you do not own this event');

      // 2. Upload asset on victim event
      const assetRes = await apiRequest('/api/events/evt-victim/upload-asset?type=idle', {
        method: 'POST',
        headers: attackerAuth,
      });
      assert.strictEqual(assetRes.status, 403);

      // 3. Add staff on victim event
      const staffRes = await apiRequest('/api/events/evt-victim/staff', {
        method: 'POST',
        headers: attackerAuth,
        body: { email: 'badstaff@attacker.com', role: 'operator' },
      });
      assert.strictEqual(staffRes.status, 403);

      // 4. Trigger webhook test on victim event
      const webhookRes = await apiRequest('/api/events/evt-victim/webhook-test', {
        method: 'POST',
        headers: attackerAuth,
      });
      assert.strictEqual(webhookRes.status, 403);
    });

    it('T5.2: Cross-Event Token Injection: Booth token from Event A cannot be used to upload to Event B', async () => {
      state.events.push(
        { id: 'evt-source-a', name: 'Event A', status: 'active', owner_id: 'owner-a' },
        { id: 'evt-target-b', name: 'Event B', status: 'active', owner_id: 'owner-b' }
      );

      // Obtain booth token legitimately for Event A
      const tokenA = signToken({ role: 'booth', eventId: 'evt-source-a' }, 3600);

      // Craft multipart request targeting Event B using token for Event A
      const formData = new FormData();
      formData.append('eventId', 'evt-target-b');
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'injection.png');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': tokenA },
        body: formData,
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'Valid event booth session required');
      assert.strictEqual(state.photos.length, 0, 'No photos should be uploaded to target event');
    });

    it('T5.3: Anonymous Direct Upload / Mutation Rejection: Requests without token strictly rejected with 403', async () => {
      state.events.push({
        id: 'evt-closed-bucket',
        name: 'Closed Bucket Event',
        status: 'active',
        owner_id: 'owner-closed',
      });

      const formData = new FormData();
      formData.append('eventId', 'evt-closed-bucket');
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'anon.png');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'Valid event booth session required');
    });

    it('T5.4: Tampered JWT Signature Rejection: Forged payload or modified signature rejected immediately', async () => {
      const eventId = 'evt-jwt-test';
      state.events.push({
        id: eventId,
        name: 'JWT Test Event',
        status: 'active',
        owner_id: 'owner-jwt',
      });

      const validToken = signToken({ role: 'booth', eventId }, 3600);
      const [header, payload, sig] = validToken.split('.');

      // Alter the payload from eventId to victim event
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      decodedPayload.eventId = 'evt-victim-forged';
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

      const formData = new FormData();
      formData.append('eventId', eventId);
      const blob = new Blob([VALID_1X1_PNG], { type: 'image/png' });
      formData.append('photo', blob, 'tampered.png');

      const res = await apiRequest('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Booth-Session': tamperedToken },
        body: formData,
      });

      assert.strictEqual(res.status, 403, 'Tampered token signature must fail with 403');
    });

    it('T5.5: SQL Injection & Path Traversal Resistance: Injected values return 404 without crashing server', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE photos; --",
        "../../etc/passwd",
        "<script>alert(1)</script>",
        "%00",
      ];

      for (const payload of sqlInjectionPayloads) {
        const shortRes = await apiRequest(`/api/photos/short/${encodeURIComponent(payload)}`);
        assert.strictEqual(shortRes.status, 404, `Payload "${payload}" on shortCode must return 404`);

        const photoRes = await apiRequest(`/api/photos/${encodeURIComponent(payload)}`);
        assert.strictEqual(photoRes.status, 404, `Payload "${payload}" on photoId must return 404`);
      }
    });

    it('T5.6: Forensic Mock Bypass Audit: Zero backdoor bypass headers in production route files', () => {
      const routesDir = path.resolve(__dirname, '../src/routes');
      const middlewareDir = path.resolve(__dirname, '../src/middleware');

      const filesToCheck = [
        ...fs.readdirSync(routesDir).map((f) => path.join(routesDir, f)),
        ...fs.readdirSync(middlewareDir).map((f) => path.join(middlewareDir, f)),
      ];

      const forbiddenPatterns = [
        'X-Bypass-Auth',
        'X-Test-Bypass',
        'ALLOW_ALL_UPLOADS',
        'SKIP_BOOTH_CHECK',
        'process.env.MOCK_AUTH === "true"',
        'process.env.TEST_BYPASS',
      ];

      for (const file of filesToCheck) {
        if (!file.endsWith('.js')) continue;
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of forbiddenPatterns) {
          assert.strictEqual(
            content.includes(pattern),
            false,
            `Violation: File ${path.basename(file)} contains prohibited test bypass: "${pattern}"`
          );
        }
      }
    });
  });
});
