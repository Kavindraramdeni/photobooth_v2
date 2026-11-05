const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { signToken } = require('../src/utils/token');

describe('Upload Deduplication & Idempotency', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('returns existing photo on retried upload with clientPhotoId without inserting duplicate row', async () => {
    const eventId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    state.events.push({
      id: eventId,
      name: 'Dedup Gala',
      status: 'active',
      owner_id: 'user-dedup',
      slug: 'dedup-gala',
    });

    const boothToken = signToken({ role: 'booth', eventId }, 3600);
    const clientUuid = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

    // Seed existing photo record with this clientPhotoId
    state.photos.push({
      id: clientUuid,
      event_id: eventId,
      url: 'https://mock-storage.snapbooth.test/original.jpg',
      thumb_url: 'https://mock-storage.snapbooth.test/original_thumb.jpg',
      gallery_url: 'http://localhost:3000/gallery/dedup-gala',
      short_code: 'dedup1',
      metadata: { clientPhotoId: clientUuid },
      is_hidden: false,
    });

    assert.strictEqual(state.photos.length, 1);

    // Now simulate client retrying upload after connection blip
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('clientPhotoId', clientUuid);
    const blob = new Blob(['image-bytes-retry'], { type: 'image/jpeg' });
    formData.append('photo', blob, 'retry.jpg');

    const res = await apiRequest('/api/photos/upload', {
      method: 'POST',
      headers: { 'X-Booth-Session': boothToken },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.deduplicated, true);
    assert.strictEqual(res.body.photo.id, clientUuid);
    assert.strictEqual(res.body.photo.url, 'https://mock-storage.snapbooth.test/original.jpg');

    // Confirm database still contains only 1 record, no duplicate created
    assert.strictEqual(state.photos.length, 1);
  });

  it('recognizes client_photo_id snake_case parameter for deduplication', async () => {
    const eventId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    state.events.push({
      id: eventId,
      name: 'Dedup Gala',
      status: 'active',
      owner_id: 'user-dedup',
      slug: 'dedup-gala',
    });

    const boothToken = signToken({ role: 'booth', eventId }, 3600);
    const clientKey = 'client-key-xyz-789';

    state.photos.push({
      id: 'existing-photo-id',
      event_id: eventId,
      url: 'https://mock-storage.snapbooth.test/photo.jpg',
      gallery_url: 'http://localhost:3000/gallery/dedup-gala',
      short_code: 'dedup2',
      metadata: { client_photo_id: clientKey },
      is_hidden: false,
    });

    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('client_photo_id', clientKey);
    const blob = new Blob(['image-bytes'], { type: 'image/jpeg' });
    formData.append('photo', blob, 'pic.jpg');

    const res = await apiRequest('/api/photos/upload', {
      method: 'POST',
      headers: { 'X-Booth-Session': boothToken },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.deduplicated, true);
    assert.strictEqual(res.body.photo.id, 'existing-photo-id');
    assert.strictEqual(state.photos.length, 1);
  });
});
