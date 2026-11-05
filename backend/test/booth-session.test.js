const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { signToken, verifyToken } = require('../src/utils/token');

describe('Booth Session Token & Media Ingestion Guards', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('issues booth session token to event owner and operator', async () => {
    state.events.push({
      id: 'evt-booth',
      name: 'Booth Event',
      status: 'active',
      owner_id: 'owner-booth',
    });

    // Owner creates booth session
    const ownerRes = await apiRequest('/api/events/evt-booth/booth-session', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-owner-booth' },
    });

    assert.strictEqual(ownerRes.status, 200);
    assert.ok(ownerRes.body.sessionToken);
    assert.strictEqual(ownerRes.body.eventId, 'evt-booth');
    assert.ok(ownerRes.body.expiresAt);

    const decoded = verifyToken(ownerRes.body.sessionToken);
    assert.strictEqual(decoded.role, 'booth');
    assert.strictEqual(decoded.eventId, 'evt-booth');

    // Operator creates booth session
    const operatorToken = signToken({ role: 'operator', eventId: 'evt-booth' }, 3600);
    const opRes = await apiRequest('/api/events/evt-booth/booth-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
    });

    assert.strictEqual(opRes.status, 200);
    assert.ok(opRes.body.sessionToken);

    // Operator from different event is rejected
    const rogueOperatorToken = signToken({ role: 'operator', eventId: 'other-evt' }, 3600);
    const rogueRes = await apiRequest('/api/events/evt-booth/booth-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rogueOperatorToken}` },
    });
    assert.strictEqual(rogueRes.status, 403);
  });

  it('rejects photo uploads without booth session token with HTTP 403', async () => {
    state.events.push({
      id: 'evt-upload',
      name: 'Upload Event',
      status: 'active',
      owner_id: 'owner-1',
    });

    // 1. Single photo upload without token
    const formData = new FormData();
    formData.append('eventId', 'evt-upload');
    const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
    formData.append('photo', blob, 'photo.jpg');

    const res = await apiRequest('/api/photos/upload', {
      method: 'POST',
      body: formData,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Valid event booth session required');

    // 2. GIF upload without token
    const gifForm = new FormData();
    gifForm.append('eventId', 'evt-upload');
    gifForm.append('frames', blob, 'frame1.jpg');
    const gifRes = await apiRequest('/api/photos/gif', {
      method: 'POST',
      body: gifForm,
    });
    assert.strictEqual(gifRes.status, 403);

    // 3. Strip upload without token
    const stripForm = new FormData();
    stripForm.append('eventId', 'evt-upload');
    stripForm.append('photos', blob, 'p1.jpg');
    const stripRes = await apiRequest('/api/photos/strip', {
      method: 'POST',
      body: stripForm,
    });
    assert.strictEqual(stripRes.status, 403);

    // 4. Burst upload without token
    const burstForm = new FormData();
    burstForm.append('eventId', 'evt-upload');
    burstForm.append('frame_0', blob, 'f0.jpg');
    const burstRes = await apiRequest('/api/photos/burst', {
      method: 'POST',
      body: burstForm,
    });
    assert.strictEqual(burstRes.status, 403);

    // 5. AI generate without token
    const aiForm = new FormData();
    aiForm.append('eventId', 'evt-upload');
    aiForm.append('file', blob, 'pic.jpg');
    const aiRes = await apiRequest('/api/ai/generate', {
      method: 'POST',
      body: aiForm,
    });
    assert.strictEqual(aiRes.status, 403);
  });

  it('rejects uploads if session token belongs to another event', async () => {
    state.events.push(
      { id: 'evt-good', name: 'Good Event', status: 'active', owner_id: 'owner-good' },
      { id: 'evt-bad', name: 'Bad Event', status: 'active', owner_id: 'owner-bad' }
    );

    const tokenForBad = signToken({ role: 'booth', eventId: 'evt-bad' }, 3600);

    const formData = new FormData();
    formData.append('eventId', 'evt-good');
    const blob = new Blob(['image-bytes'], { type: 'image/jpeg' });
    formData.append('photo', blob, 'pic.jpg');

    const res = await apiRequest('/api/photos/upload', {
      method: 'POST',
      headers: { 'X-Booth-Session': tokenForBad },
      body: formData,
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Valid event booth session required');
  });
});
