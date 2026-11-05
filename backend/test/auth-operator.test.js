const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, apiRequest, resetDb, state } = require('./helpers/testServer');
const { verifyToken } = require('../src/utils/token');

describe('Operator PIN Authentication & Scoped JWT', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetDb();
  });

  it('authenticates valid operator PIN and issues 12-hour scoped JWT', async () => {
    state.events.push({
      id: 'evt-alpha',
      name: 'Alpha Gala',
      status: 'active',
      settings: { operatorPin: '5842' },
      owner_id: 'user-alpha',
    });

    const res = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-alpha', pin: '5842' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'Must return token');
    assert.strictEqual(res.body.operator.role, 'operator');
    assert.strictEqual(res.body.operator.eventId, 'evt-alpha');
    assert.ok(res.body.operator.expiresAt);

    // Verify token structure and payload
    const decoded = verifyToken(res.body.token);
    assert.ok(decoded, 'Token must be valid');
    assert.strictEqual(decoded.role, 'operator');
    assert.strictEqual(decoded.eventId, 'evt-alpha');
    assert.strictEqual(decoded.sub, 'operator:evt-alpha');

    const expectedExpiry = Math.floor(Date.now() / 1000) + 12 * 3600;
    // Expiration must be within 5 seconds of 12 hours from now
    assert.ok(Math.abs(decoded.exp - expectedExpiry) < 5);
  });

  it('rejects invalid PIN with 401 error', async () => {
    state.events.push({
      id: 'evt-alpha',
      name: 'Alpha Gala',
      status: 'active',
      settings: { operatorPin: '5842' },
      owner_id: 'user-alpha',
    });

    const res = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-alpha', pin: '9999' },
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Invalid operator PIN');
  });

  it('rejects missing eventId or PIN with 401', async () => {
    const res = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: '', pin: '' },
    });
    assert.strictEqual(res.status, 401);
  });

  it('authenticates via legacy route /api/events/:id/operator-login for backward compatibility', async () => {
    state.events.push({
      id: 'evt-beta',
      name: 'Beta Party',
      status: 'active',
      settings: { operatorPin: '7788' },
      owner_id: 'user-beta',
    });

    const res = await apiRequest('/api/events/evt-beta/operator-login', {
      method: 'POST',
      body: { pin: '7788' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.operator.role, 'operator');
    assert.strictEqual(res.body.operator.eventId, 'evt-beta');
  });

  it('prevents operator token from modifying other tenants events', async () => {
    state.events.push(
      { id: 'evt-tenant-1', name: 'Tenant 1', owner_id: 'owner-1', settings: { operatorPin: '1111' }, status: 'active' },
      { id: 'evt-tenant-2', name: 'Tenant 2', owner_id: 'owner-2', settings: { operatorPin: '2222' }, status: 'active' }
    );

    // Operator logs in to Tenant 1
    const loginRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-tenant-1', pin: '1111' },
    });
    const operatorToken = loginRes.body.token;

    // Operator tries to modify Tenant 2 event
    const crossTenantRes = await apiRequest('/api/events/evt-tenant-2', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: { name: 'Hacked Name' },
    });
    assert.strictEqual(crossTenantRes.status, 404); // update query searches .eq('owner_id', req.user.id), not found

    // Operator cannot access Tenant 2 stats
    const crossStats = await apiRequest('/api/events/evt-tenant-2/stats', {
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert.strictEqual(crossStats.status, 403);
  });

  it('validates operator PIN using constant-time comparison across variable lengths and whitespace', async () => {
    state.events.push({
      id: 'evt-timing',
      name: 'Timing Safe Event',
      owner_id: 'user-timing',
      operator_pin: '4321',
      status: 'active',
    });

    // 1. Valid PIN with whitespace trimming
    const validRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-timing', pin: '  4321  ' },
    });
    assert.strictEqual(validRes.status, 200);
    assert.ok(validRes.body.token);

    // 2. Length mismatch: shorter string (should not throw RangeError in timingSafeEqual)
    const shortRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-timing', pin: '43' },
    });
    assert.strictEqual(shortRes.status, 401);
    assert.strictEqual(shortRes.body.error, 'Invalid operator PIN');

    // 3. Length mismatch: longer string
    const longRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-timing', pin: '43219999999999' },
    });
    assert.strictEqual(longRes.status, 401);
    assert.strictEqual(longRes.body.error, 'Invalid operator PIN');

    // 4. Same length but different characters
    const diffRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-timing', pin: '4322' },
    });
    assert.strictEqual(diffRes.status, 401);
    assert.strictEqual(diffRes.body.error, 'Invalid operator PIN');

    // 5. Event without configured PIN
    state.events.push({
      id: 'evt-no-pin',
      name: 'No Pin Event',
      owner_id: 'user-timing',
      operator_pin: '',
      status: 'active',
    });
    const noPinRes = await apiRequest('/api/auth/operator-login', {
      method: 'POST',
      body: { eventId: 'evt-no-pin', pin: '1234' },
    });
    assert.strictEqual(noPinRes.status, 401);
  });
});
