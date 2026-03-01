/**
 * Backend test suite — photos routes
 * Run: npm test
 *
 * Mocks: Supabase, storage, imageProcessor, fetchBuffer
 * No production credentials required.
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ── Mock all external dependencies before requiring the router ────────────

// Mock Supabase
const mockSupabase = {
  from: jest.fn(),
};
jest.mock('../src/services/database', () => mockSupabase);

// Mock storage
jest.mock('../src/services/storage', () => ({
  uploadToStorage: jest.fn().mockResolvedValue('https://cdn.example.com/photo.jpg'),
  deleteFromStorage: jest.fn().mockResolvedValue(true),
}));

// Mock imageProcessor — branding overlay just returns input unchanged
jest.mock('../src/services/imageProcessor', () => ({
  applyBrandingOverlay: jest.fn().mockImplementation((buf) => Promise.resolve(buf)),
  createPhotoStrip: jest.fn().mockResolvedValue(Buffer.from('strip')),
}));

// Mock sharing helpers
jest.mock('../src/services/sharing', () => ({
  generateQRDataURL: jest.fn().mockResolvedValue('data:image/png;base64,qr'),
  buildGalleryUrl: jest.fn().mockReturnValue('https://app.example.com/gallery/test'),
  buildWhatsAppUrl: jest.fn().mockReturnValue('https://wa.me/?text=test'),
}));

// Mock GIF/boomerang
jest.mock('../src/services/gif', () => ({
  createGIF: jest.fn().mockResolvedValue(Buffer.from('gif')),
  createBoomerang: jest.fn().mockResolvedValue(Buffer.from('boomerang')),
}));

// Mock sharp — returns a tiny valid JPEG buffer
jest.mock('sharp', () => {
  const chain = {
    resize: () => chain,
    jpeg: () => chain,
    toBuffer: () => Promise.resolve(Buffer.from('jpeg-data')),
    metadata: () => Promise.resolve({ width: 100, height: 100 }),
    composite: () => chain,
  };
  const sharpFn = () => chain;
  return sharpFn;
});

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a mock Supabase chain for a given table.
 * Usage: mockTable('events', { data: eventObj, error: null })
 */
function mockTable(table, result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue(result),
  };
  mockSupabase.from.mockImplementation(() => chain);
  return chain;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  // Fresh require each time so mocks take effect
  jest.resetModules();
  const router = require('../src/routes/photos');
  app.use('/api/photos', router);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/photos/upload', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when photo file is missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/photos/upload')
      .field('eventId', 'evt-123');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no photo/i);
  });

  test('returns 400 when eventId is missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/photos/upload')
      .attach('photo', Buffer.from('fake-image'), { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event id/i);
  });

  test('returns 404 when event does not exist', async () => {
    mockTable('events', { data: null, error: null });
    const app = makeApp();

    const res = await request(app)
      .post('/api/photos/upload')
      .attach('photo', Buffer.from('fake-image'), { filename: 'test.jpg', contentType: 'image/jpeg' })
      .field('eventId', 'nonexistent-event');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/event not found/i);
  });

  test('returns 200 with photo data on success', async () => {
    const fakeEvent = {
      id: 'evt-123', name: 'Test Event', slug: 'test-event',
      branding: { footerText: '', showDate: false },
      settings: {},
    };
    mockTable('events', { data: fakeEvent, error: null });
    const app = makeApp();

    const res = await request(app)
      .post('/api/photos/upload')
      .attach('photo', Buffer.from('fake-image'), { filename: 'test.jpg', contentType: 'image/jpeg' })
      .field('eventId', 'evt-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.photo).toHaveProperty('url');
    expect(res.body.photo).toHaveProperty('qrCode');
  });
});

describe('GET /api/photos/event/:eventId/zip', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when event has no photos', async () => {
    // photos query returns empty
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: { name: 'Test' }, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const app = makeApp();
    const res = await request(app).get('/api/photos/event/evt-123/zip');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no photos/i);
  });

  test('skips a photo that returns non-2xx and still completes ZIP', async () => {
    const photos = [
      { id: 'p1', url: 'https://cdn.example.com/good.jpg', mode: 'single', created_at: '2025-01-01' },
      { id: 'p2', url: 'https://cdn.example.com/missing.jpg', mode: 'single', created_at: '2025-01-01' },
    ];

    // First call (photos list), second call (event name)
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: photos, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { name: 'Test Event' }, error: null }),
      };
    });

    // Mock fetchBuffer: good URL resolves, missing URL rejects
    const photosModule = require('../src/routes/photos');
    const originalFetchBuffer = photosModule.fetchBuffer;

    jest.spyOn(photosModule, 'fetchBuffer').mockImplementation((url) => {
      if (url.includes('missing')) {
        return Promise.reject(new Error('HTTP 404 for ' + url));
      }
      return Promise.resolve(Buffer.from('image-data'));
    });

    const app = makeApp();
    const res = await request(app)
      .get('/api/photos/event/evt-123/zip')
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    // Should still return a ZIP (not 500) — bad photo was skipped
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/zip/);

    jest.restoreAllMocks();
  });

  test('skips a photo that returns HTML content-type (storage CDN error page)', async () => {
    const photos = [
      { id: 'p1', url: 'https://cdn.example.com/photo.jpg', mode: 'single', created_at: '2025-01-01' },
    ];

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: photos, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { name: 'Test Event' }, error: null }),
      };
    });

    const photosModule = require('../src/routes/photos');
    jest.spyOn(photosModule, 'fetchBuffer').mockRejectedValue(
      new Error('Unexpected content-type "text/html" for https://cdn.example.com/photo.jpg')
    );

    const app = makeApp();
    const res = await request(app)
      .get('/api/photos/event/evt-123/zip')
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    jest.restoreAllMocks();
  });
});

describe('hasBrandingContent', () => {
  const { hasBrandingContent } = require('../src/routes/photos');

  test('returns false for null branding', () => {
    expect(hasBrandingContent(null)).toBe(false);
  });

  test('returns false when all fields are empty/off', () => {
    expect(hasBrandingContent({ footerText: '', overlayText: '', showDate: false })).toBe(false);
  });

  test('returns false when footerText is only whitespace', () => {
    expect(hasBrandingContent({ footerText: '   ', showDate: false })).toBe(false);
  });

  test('returns true when footerText is set', () => {
    expect(hasBrandingContent({ footerText: 'Sarah & John' })).toBe(true);
  });

  test('returns true when showDate is true', () => {
    expect(hasBrandingContent({ showDate: true })).toBe(true);
  });

  test('returns true when overlayText is set', () => {
    expect(hasBrandingContent({ overlayText: '#Wedding2025' })).toBe(true);
  });

  test('returns false by default — no text stamped on clean new events', () => {
    // New events have no footerText, no overlayText, showDate defaults to false
    expect(hasBrandingContent({ primaryColor: '#7c3aed', eventName: 'My Wedding' })).toBe(false);
  });
});

describe('fetchBuffer', () => {
  const { fetchBuffer } = require('../src/routes/photos');
  const http = require('http');

  let server;
  let baseUrl;

  afterEach(() => {
    if (server) { server.close(); server = null; }
  });

  function startServer(handler) {
    return new Promise((resolve) => {
      server = http.createServer(handler);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = 'http://127.0.0.1:' + server.address().port;
        resolve();
      });
    });
  }

  test('resolves with buffer for 200 image response', async () => {
    await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(Buffer.from('fake-jpeg'));
    });
    const buf = await fetchBuffer(baseUrl + '/photo.jpg');
    expect(buf.toString()).toBe('fake-jpeg');
  });

  test('rejects for 404 response', async () => {
    await startServer((req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html>Not Found</html>');
    });
    await expect(fetchBuffer(baseUrl + '/missing.jpg')).rejects.toThrow('HTTP 404');
  });

  test('rejects for HTML content-type even on 200', async () => {
    await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html>Error Page</html>');
    });
    await expect(fetchBuffer(baseUrl + '/error')).rejects.toThrow(/content-type/i);
  });

  test('rejects on connection timeout', async () => {
    // Server that never responds
    await startServer(() => {}); // handler hangs
    await expect(
      fetchBuffer(baseUrl + '/hang', { connectTimeoutMs: 100, responseTimeoutMs: 200 })
    ).rejects.toThrow(/timeout/i);
  });
});
