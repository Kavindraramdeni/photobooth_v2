const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state, deletedKeys } = require('./helpers/testServer');
const { signToken } = require('../src/utils/token');

describe('Event Security & Subresource Lockdown', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('blocks unauthenticated access to /stats with 401', async () => {
    const res = await apiRequest('/api/events/evt-123/stats');
    assert.strictEqual(res.status, 401);
  });

  it('blocks non-owner access to /stats with 403', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    const res = await apiRequest('/api/events/evt-100/stats', {
      headers: { Authorization: 'Bearer owner-token-user-attacker' },
    });
    assert.strictEqual(res.status, 403);
  });

  it('allows event owner to access /stats', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    const res = await apiRequest('/api/events/evt-100/stats', {
      headers: { Authorization: 'Bearer owner-token-user-owner' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.stats);
  });

  it('blocks unauthenticated styles mutation and non-owner styles creation', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    // Unauthenticated
    const unauthRes = await apiRequest('/api/events/evt-100/styles', {
      method: 'POST',
      body: { name: 'Comic Book', prompt: 'comic style' },
    });
    assert.strictEqual(unauthRes.status, 401);

    // Non-owner attacker
    const nonOwnerRes = await apiRequest('/api/events/evt-100/styles', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { name: 'Comic Book', prompt: 'comic style' },
    });
    assert.strictEqual(nonOwnerRes.status, 403);

    // Legitimate owner
    const ownerRes = await apiRequest('/api/events/evt-100/styles', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { name: 'Comic Book', prompt: 'comic style' },
    });
    assert.strictEqual(ownerRes.status, 200);
    assert.ok(ownerRes.body.style);
    assert.strictEqual(ownerRes.body.style.name, 'Comic Book');
  });

  it('blocks unauthenticated upload-asset and allows owner', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    const res = await apiRequest('/api/events/evt-100/upload-asset?type=idle', {
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  });

  it('parses relative storage key when deleting frames', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    state.event_frames.push({
      id: 'frame-123',
      event_id: 'evt-100',
      name: 'Gold Border',
      url: 'https://pub-r2.example.com/events/evt-100/frames/frame-123.png',
    });

    const res = await apiRequest('/api/events/evt-100/frames/frame-123', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // Verify that relative key was extracted and passed to deleteFromStorage
    assert.ok(deletedKeys.includes('events/evt-100/frames/frame-123.png'));
  });

  it('enforces owner boundary on staff management routes', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
      settings: { staff: [] },
    });

    // Unauthenticated GET
    const unauthGet = await apiRequest('/api/events/evt-100/staff');
    assert.strictEqual(unauthGet.status, 401);

    // Non-owner POST
    const nonOwnerPost = await apiRequest('/api/events/evt-100/staff', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { email: 'staff@example.com', role: 'operator', name: 'John' },
    });
    assert.strictEqual(nonOwnerPost.status, 403);

    // Owner POST
    const ownerPost = await apiRequest('/api/events/evt-100/staff', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { email: 'staff@example.com', role: 'operator', name: 'John' },
    });
    assert.strictEqual(ownerPost.status, 201);
    assert.strictEqual(ownerPost.body.staff.email, 'staff@example.com');

    // Owner GET
    const ownerGet = await apiRequest('/api/events/evt-100/staff', {
      headers: { Authorization: 'Bearer owner-token-user-owner' },
    });
    assert.strictEqual(ownerGet.status, 200);
    assert.strictEqual(ownerGet.body.staff.length, 1);
    assert.strictEqual(ownerGet.body.staff[0].email, 'staff@example.com');
  });

  it('locks down backgrounds and templates mutation routes', async () => {
    state.events.push({
      id: 'evt-100',
      owner_id: 'user-owner',
      name: 'Owner Event',
      status: 'active',
    });

    // Unauthenticated template creation
    const unauthTpl = await apiRequest('/api/templates/evt-100', {
      method: 'POST',
      body: { name: 'VIP Template' },
    });
    assert.strictEqual(unauthTpl.status, 401);

    // Non-owner template creation
    const nonOwnerTpl = await apiRequest('/api/templates/evt-100', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { name: 'VIP Template' },
    });
    assert.strictEqual(nonOwnerTpl.status, 403);

    // Owner template creation
    const ownerTpl = await apiRequest('/api/templates/evt-100', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { name: 'VIP Template' },
    });
    assert.strictEqual(ownerTpl.status, 200);
    assert.ok(ownerTpl.body.template);
  });

  it('enforces event ownership on POST /api/events/:id/webhook-test', async () => {
    state.events.push({
      id: 'evt-webhook',
      owner_id: 'user-owner',
      name: 'Webhook Event',
      status: 'active',
    });

    // 1. Unauthenticated request: 401
    const unauthRes = await apiRequest('/api/events/evt-webhook/webhook-test', {
      method: 'POST',
      body: { webhookUrl: 'https://example.com/webhook' },
    });
    assert.strictEqual(unauthRes.status, 401);

    // 2. Non-owner attacker: 403
    const nonOwnerRes = await apiRequest('/api/events/evt-webhook/webhook-test', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { webhookUrl: 'https://example.com/webhook' },
    });
    assert.strictEqual(nonOwnerRes.status, 403);
    assert.strictEqual(nonOwnerRes.body.error, 'Access denied: you do not own this event');

    // 3. Non-existent event: 404
    const notFoundRes = await apiRequest('/api/events/evt-doesnotexist/webhook-test', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { webhookUrl: 'https://example.com/webhook' },
    });
    assert.strictEqual(notFoundRes.status, 404);
  });

  it('enforces event ownership on all /api/ai/event-styles routes', async () => {
    state.events.push({
      id: 'evt-ai-styles',
      owner_id: 'user-owner',
      name: 'AI Style Event',
      status: 'active',
    });

    state.event_styles.push({
      id: 'style-alpha',
      event_id: 'evt-ai-styles',
      style_key: 'cyberpunk',
      name: 'Cyberpunk',
      emoji: '🤖',
      prompt: 'cyberpunk neon city portrait',
      enabled: true,
      display_order: 1,
    });

    // ── GET /api/ai/event-styles/:eventId ──
    const getUnauth = await apiRequest('/api/ai/event-styles/evt-ai-styles');
    assert.strictEqual(getUnauth.status, 401);

    const getNonOwner = await apiRequest('/api/ai/event-styles/evt-ai-styles', {
      headers: { Authorization: 'Bearer owner-token-attacker' },
    });
    assert.strictEqual(getNonOwner.status, 403);

    const getOwner = await apiRequest('/api/ai/event-styles/evt-ai-styles', {
      headers: { Authorization: 'Bearer owner-token-user-owner' },
    });
    assert.strictEqual(getOwner.status, 200);
    assert.strictEqual(getOwner.body.styles.length, 1);

    // ── POST /api/ai/event-styles ──
    const postUnauth = await apiRequest('/api/ai/event-styles', {
      method: 'POST',
      body: { eventId: 'evt-ai-styles', styleKey: 'vintage', name: 'Vintage', prompt: 'retro film' },
    });
    assert.strictEqual(postUnauth.status, 401);

    const postNonOwner = await apiRequest('/api/ai/event-styles', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { eventId: 'evt-ai-styles', styleKey: 'vintage', name: 'Vintage', prompt: 'retro film' },
    });
    assert.strictEqual(postNonOwner.status, 403);

    const postOwner = await apiRequest('/api/ai/event-styles', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { eventId: 'evt-ai-styles', styleKey: 'vintage', name: 'Vintage', prompt: 'retro film' },
    });
    assert.strictEqual(postOwner.status, 200);
    assert.strictEqual(postOwner.body.style.name, 'Vintage');

    // ── PATCH /api/ai/event-styles/:styleId ──
    const patchUnauth = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'PATCH',
      body: { name: 'Cyberpunk 2077' },
    });
    assert.strictEqual(patchUnauth.status, 401);

    const patchNonOwner = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner-token-attacker' },
      body: { name: 'Cyberpunk 2077' },
    });
    assert.strictEqual(patchNonOwner.status, 403);

    const patchOwner = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
      body: { name: 'Cyberpunk 2077' },
    });
    assert.strictEqual(patchOwner.status, 200);
    assert.strictEqual(patchOwner.body.style.name, 'Cyberpunk 2077');

    // ── POST /api/ai/event-styles/:styleId/upload-preview ──
    const uploadUnauth = await apiRequest('/api/ai/event-styles/style-alpha/upload-preview', {
      method: 'POST',
    });
    assert.strictEqual(uploadUnauth.status, 401);

    const uploadNonOwner = await apiRequest('/api/ai/event-styles/style-alpha/upload-preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer owner-token-attacker' },
    });
    assert.strictEqual(uploadNonOwner.status, 403);

    // ── DELETE /api/ai/event-styles/:styleId ──
    const deleteUnauth = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'DELETE',
    });
    assert.strictEqual(deleteUnauth.status, 401);

    const deleteNonOwner = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token-attacker' },
    });
    assert.strictEqual(deleteNonOwner.status, 403);

    const deleteOwner = await apiRequest('/api/ai/event-styles/style-alpha', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token-user-owner' },
    });
    assert.strictEqual(deleteOwner.status, 200);
    assert.strictEqual(deleteOwner.body.success, true);
  });
});
