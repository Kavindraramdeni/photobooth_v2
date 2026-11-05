const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');

describe('Photo Privacy Control & is_hidden Enforcement', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('enforces is_hidden = false on GET /api/photos/:photoId for public callers, allows owner', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
      slug: 'private-event',
    });

    state.photos.push(
      {
        id: 'photo-visible',
        event_id: 'evt-priv',
        url: 'https://example.com/p1.jpg',
        is_hidden: false,
      },
      {
        id: 'photo-hidden',
        event_id: 'evt-priv',
        url: 'https://example.com/p2.jpg',
        is_hidden: true,
      }
    );

    // Visible photo: public gets 200
    const visibleRes = await apiRequest('/api/photos/photo-visible');
    assert.strictEqual(visibleRes.status, 200);
    assert.strictEqual(visibleRes.body.photo.id, 'photo-visible');

    // Hidden photo: public gets 404
    const hiddenPublicRes = await apiRequest('/api/photos/photo-hidden');
    assert.strictEqual(hiddenPublicRes.status, 404);

    // Hidden photo: owner gets 200
    const hiddenOwnerRes = await apiRequest('/api/photos/photo-hidden', {
      headers: { Authorization: 'Bearer owner-token-owner-vip' },
    });
    assert.strictEqual(hiddenOwnerRes.status, 200);
    assert.strictEqual(hiddenOwnerRes.body.photo.id, 'photo-hidden');
  });

  it('enforces is_hidden = false on GET /api/photos/short/:shortCode and includes slug', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
      slug: 'private-event-slug',
    });

    state.photos.push(
      {
        id: 'photo-short-vis',
        short_code: 'code123',
        event_id: 'evt-priv',
        url: 'https://example.com/p1.jpg',
        is_hidden: false,
      },
      {
        id: 'photo-short-hid',
        short_code: 'secretCode',
        event_id: 'evt-priv',
        url: 'https://example.com/p2.jpg',
        is_hidden: true,
      }
    );

    // Visible photo: 200 and includes slug in event join
    const res = await apiRequest('/api/photos/short/code123');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.photo.short_code, 'code123');
    assert.strictEqual(res.body.photo.events.slug, 'private-event-slug');

    // Hidden photo: 404
    const hiddenRes = await apiRequest('/api/photos/short/secretCode');
    assert.strictEqual(hiddenRes.status, 404);
  });

  it('enforces is_hidden = false on GET /api/photos/:photoId/stories', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
    });

    state.photos.push({
      id: 'photo-stories-hid',
      event_id: 'evt-priv',
      url: 'https://example.com/p-hid.jpg',
      is_hidden: true,
    });

    const res = await apiRequest('/api/photos/photo-stories-hid/stories');
    assert.strictEqual(res.status, 404);
  });

  it('enforces is_hidden = false on GET /api/share/:photoId', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
    });

    state.photos.push({
      id: 'photo-share-hid',
      event_id: 'evt-priv',
      url: 'https://example.com/p-hid.jpg',
      is_hidden: true,
    });

    const res = await apiRequest('/api/share/photo-share-hid');
    assert.strictEqual(res.status, 404);
  });

  it('enforces is_hidden = false on POST /api/share/email (rejects hidden photo with 404)', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
    });

    state.photos.push(
      {
        id: 'photo-share-email-hid',
        event_id: 'evt-priv',
        url: 'https://example.com/p-hid.jpg',
        is_hidden: true,
      },
      {
        id: 'photo-share-email-vis',
        event_id: 'evt-priv',
        url: 'https://example.com/p-vis.jpg',
        is_hidden: false,
      }
    );

    // Hidden photo must return 404 Photo not found or unavailable
    const hiddenRes = await apiRequest('/api/share/email', {
      method: 'POST',
      body: { photoId: 'photo-share-email-hid', toEmail: 'guest@example.com' },
    });
    assert.strictEqual(hiddenRes.status, 404);
    assert.strictEqual(hiddenRes.body.error, 'Photo not found or unavailable');

    // Visible photo succeeds (email fallback mode)
    const visRes = await apiRequest('/api/share/email', {
      method: 'POST',
      body: { photoId: 'photo-share-email-vis', toEmail: 'guest@example.com' },
    });
    assert.strictEqual(visRes.status, 200);
    assert.strictEqual(visRes.body.fallback, true);
  });

  it('enforces is_hidden = false on POST /api/share/sms (rejects hidden photo with 404)', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
    });

    state.photos.push({
      id: 'photo-share-sms-hid',
      event_id: 'evt-priv',
      url: 'https://example.com/p-hid.jpg',
      is_hidden: true,
    });

    const res = await apiRequest('/api/share/sms', {
      method: 'POST',
      body: { photoId: 'photo-share-sms-hid', toPhone: '+15551234567' },
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Photo not found or unavailable');
  });

  it('enforces is_hidden = false on POST /api/email/photo (rejects hidden photo with 404)', async () => {
    state.events.push({
      id: 'evt-priv',
      name: 'Private Event',
      owner_id: 'owner-vip',
      status: 'active',
    });

    state.photos.push(
      {
        id: 'photo-email-photo-hid',
        event_id: 'evt-priv',
        url: 'https://example.com/p-hid.jpg',
        is_hidden: true,
      },
      {
        id: 'photo-email-photo-vis',
        event_id: 'evt-priv',
        url: 'https://example.com/p-vis.jpg',
        is_hidden: false,
      }
    );

    // Hidden photo returns 404 Photo not found or unavailable
    const hiddenRes = await apiRequest('/api/email/photo', {
      method: 'POST',
      body: { photoId: 'photo-email-photo-hid', email: 'guest@example.com' },
    });
    assert.strictEqual(hiddenRes.status, 404);
    assert.strictEqual(hiddenRes.body.error, 'Photo not found or unavailable');

    // Visible photo returns 200 with fallback
    const visRes = await apiRequest('/api/email/photo', {
      method: 'POST',
      body: { photoId: 'photo-email-photo-vis', email: 'guest@example.com' },
    });
    assert.strictEqual(visRes.status, 200);
    assert.strictEqual(visRes.body.fallback, true);
  });
});
