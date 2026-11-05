const http = require('http');
const { app } = require('../../src/index');
const database = require('../../src/services/database');
const { __setMockStorage } = require('../../src/services/storage');
const { createMockSupabase, resetDb, state } = require('./mockDb');

let server = null;
let baseUrl = '';
const storedFiles = new Map();
const deletedKeys = [];

function startServer() {
  return new Promise((resolve) => {
    // Plug in mock database
    const mockSupabase = createMockSupabase();
    database.__setClient(mockSupabase);

    // Plug in mock storage
    storedFiles.clear();
    deletedKeys.length = 0;
    __setMockStorage({
      upload: async (buffer, key, contentType) => {
        const url = `https://mock-storage.snapbooth.test/${key}`;
        storedFiles.set(key, { buffer, contentType, url });
        return url;
      },
      delete: async (key) => {
        deletedKeys.push(key);
        storedFiles.delete(key);
      },
      getSignedUrl: async (key) => `https://mock-storage.snapbooth.test/${key}?signed=true`,
    });

    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve({ server, baseUrl });
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    body: data,
  };
}

module.exports = {
  startServer,
  stopServer,
  apiRequest,
  resetDb,
  state,
  storedFiles,
  deletedKeys,
};
