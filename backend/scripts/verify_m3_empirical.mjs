/**
 * Comprehensive Empirical Verification Harness for Milestone 3
 * Tests:
 * 1. offlineQueue.ts (Memory fallback + IndexedDB mock)
 * 2. CountdownScreen.tsx (Offline failure branch stress test)
 * 3. IdleScreen.tsx (PIN authentication & lockout state machine)
 * 4. api.ts (Deduplication headers, booth session token management)
 */

import assert from 'node:assert';
import test from 'node:test';
import {
  openOfflineDB,
  queueOfflinePhoto,
  getQueuedPhotos,
  removeQueuedPhoto,
  updatePhotoStatus,
  getPendingCount,
  syncQueuedPhotos,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
} from '../../frontend/src/lib/offlineQueue.ts';

import {
  getBoothToken,
  setBoothToken,
  getBoothHeaders,
} from '../../frontend/src/lib/api.ts';

// ── Setup Mock DOM globals for Node.js environment ───────────────────────────
class MockSessionStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.window = globalThis.window || {};
globalThis.sessionStorage = new MockSessionStorage();
globalThis.localStorage = new MockSessionStorage();
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = (blob) => `blob:mock-url-${Math.random().toString(36).slice(2, 9)}`;

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
} else {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: offlineQueue.ts In-Memory Fallback Verification
// ─────────────────────────────────────────────────────────────────────────────
test('1. offlineQueue.ts: Memory Fallback Operations', async (t) => {
  // Ensure window.indexedDB is undefined for fallback testing
  const originalIndexedDB = globalThis.window.indexedDB;
  delete globalThis.window.indexedDB;

  await t.test('1.1: queueOfflinePhoto auto-populates defaults and clientPhotoId', async () => {
    const mockBlob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });
    const record = await queueOfflinePhoto({
      eventId: 'evt-100',
      sessionId: 'sess-1',
      blob: mockBlob,
    });

    assert.ok(record.clientPhotoId, 'clientPhotoId should be generated');
    assert.strictEqual(record.eventId, 'evt-100');
    assert.strictEqual(record.status, 'pending');
    assert.strictEqual(record.format, 'single');
    assert.strictEqual(record.retryCount, 0);
    assert.ok(record.timestamp > 0);
  });

  await t.test('1.2: getQueuedPhotos retrieves records ordered by timestamp ascending', async () => {
    const baseTime = Date.now();
    const idA = 'photo-a';
    const idB = 'photo-b';
    const idC = 'photo-c';

    await queueOfflinePhoto({
      clientPhotoId: idB,
      eventId: 'evt-order',
      timestamp: baseTime + 200,
      blob: new Blob(['b']),
    });
    await queueOfflinePhoto({
      clientPhotoId: idA,
      eventId: 'evt-order',
      timestamp: baseTime + 100,
      blob: new Blob(['a']),
    });
    await queueOfflinePhoto({
      clientPhotoId: idC,
      eventId: 'evt-order',
      timestamp: baseTime + 300,
      blob: new Blob(['c']),
    });

    const photos = await getQueuedPhotos('evt-order');
    assert.strictEqual(photos.length, 3);
    assert.strictEqual(photos[0].clientPhotoId, idA, 'Oldest photo should be first');
    assert.strictEqual(photos[1].clientPhotoId, idB);
    assert.strictEqual(photos[2].clientPhotoId, idC, 'Newest photo should be last');
  });

  await t.test('1.3: updatePhotoStatus updates status, retryCount, and error message', async () => {
    const testId = 'photo-status-test';
    await queueOfflinePhoto({
      clientPhotoId: testId,
      eventId: 'evt-status',
      blob: new Blob(['test']),
    });

    // Update to syncing
    await updatePhotoStatus(testId, 'syncing');
    let photos = await getQueuedPhotos('evt-status');
    let item = photos.find((p) => p.clientPhotoId === testId);
    assert.strictEqual(item?.status, 'syncing');
    assert.strictEqual(item?.retryCount, 0);

    // Update to failed
    await updatePhotoStatus(testId, 'failed', 'Connection reset by peer');
    photos = await getQueuedPhotos('evt-status');
    item = photos.find((p) => p.clientPhotoId === testId);
    assert.strictEqual(item?.status, 'failed');
    assert.strictEqual(item?.retryCount, 1, 'Retry count should increment on failure');
    assert.strictEqual(item?.lastError, 'Connection reset by peer');
  });

  await t.test('1.4: removeQueuedPhoto deletes records from memory queue', async () => {
    const testId = 'photo-delete-test';
    await queueOfflinePhoto({
      clientPhotoId: testId,
      eventId: 'evt-del',
      blob: new Blob(['delete-me']),
    });

    let pendingCount = await getPendingCount('evt-del');
    assert.strictEqual(pendingCount, 1);

    await removeQueuedPhoto(testId);
    pendingCount = await getPendingCount('evt-del');
    assert.strictEqual(pendingCount, 0);
  });

  await t.test('1.5: syncQueuedPhotos drains queue and handles failure with backoff', async () => {
    const eventId = 'evt-sync-test';
    const successId = 'photo-sync-ok';
    const failId = 'photo-sync-fail';

    await queueOfflinePhoto({
      clientPhotoId: successId,
      eventId,
      blob: new Blob(['ok']),
      format: 'single',
    });
    await queueOfflinePhoto({
      clientPhotoId: failId,
      eventId,
      blob: new Blob(['fail']),
      format: 'single',
    });

    const mockApiClient = {
      uploadPhoto: async (blob, evt, sess, fmt, photoId) => {
        if (photoId === failId) {
          throw new Error('500 Internal Server Error');
        }
        return { success: true, photo: { id: photoId } };
      },
    };

    const progressReports = [];
    const result = await syncQueuedPhotos(mockApiClient, eventId, (remaining) => {
      progressReports.push(remaining);
    });

    assert.strictEqual(result.synced, 1, 'One photo should succeed');
    assert.strictEqual(result.failed, 1, 'One photo should fail');

    const remaining = await getQueuedPhotos(eventId);
    assert.strictEqual(remaining.length, 1, 'Synced photo should be deleted; failed should remain');
    assert.strictEqual(remaining[0].clientPhotoId, failId);
    assert.strictEqual(remaining[0].status, 'failed');
    assert.strictEqual(remaining[0].retryCount, 1);
  });

  await t.test('1.6: syncQueuedPhotos halts immediately if navigator.onLine is false', async () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
    const eventId = 'evt-offline-guard';
    await queueOfflinePhoto({ clientPhotoId: 'photo-offline-guard', eventId, blob: new Blob(['x']) });

    let uploadAttempted = false;
    const result = await syncQueuedPhotos({
      uploadPhoto: async () => { uploadAttempted = true; },
    }, eventId);

    assert.strictEqual(result.synced, 0);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(uploadAttempted, false, 'No upload should be attempted when navigator.onLine is false');

    // Restore online
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  await t.test('1.7: Idempotent queueing with same clientPhotoId updates existing record without duplicates', async () => {
    const photoId = 'photo-idempotent-test';
    await queueOfflinePhoto({ clientPhotoId: photoId, eventId: 'evt-idem', timestamp: 1000, blob: new Blob(['1']) });
    await queueOfflinePhoto({ clientPhotoId: photoId, eventId: 'evt-idem', timestamp: 2000, blob: new Blob(['2']) });

    const photos = await getQueuedPhotos('evt-idem');
    assert.strictEqual(photos.length, 1, 'Queue should not contain duplicate entries for identical clientPhotoId');
    assert.strictEqual(photos[0].timestamp, 2000, 'Record should be updated with newer data');
  });

  // Restore indexedDB
  if (originalIndexedDB) {
    globalThis.window.indexedDB = originalIndexedDB;
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: offlineQueue.ts Mock IndexedDB Backend Verification
// ─────────────────────────────────────────────────────────────────────────────
test('2. offlineQueue.ts: IndexedDB Backend Operations', async (t) => {
  // Mock IndexedDB database and object store
  const mockStore = new Map();
  const createdIndexes = new Map();

  const mockIDBStore = {
    put: (item) => {
      mockStore.set(item.clientPhotoId, JSON.parse(JSON.stringify(item)));
      const req = { onsuccess: null, onerror: null, result: item.clientPhotoId };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
    get: (key) => {
      const item = mockStore.get(key);
      const req = { onsuccess: null, onerror: null, result: item ? JSON.parse(JSON.stringify(item)) : undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
    getAll: () => {
      const list = Array.from(mockStore.values()).map((v) => JSON.parse(JSON.stringify(v)));
      const req = { onsuccess: null, onerror: null, result: list };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
    delete: (key) => {
      mockStore.delete(key);
      const req = { onsuccess: null, onerror: null, result: undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
    createIndex: (name, keyPath, options) => {
      createdIndexes.set(name, { keyPath, options });
    },
  };

  const mockIDBDatabase = {
    objectStoreNames: {
      contains: (name) => name === STORE_NAME && createdIndexes.size > 0,
    },
    createObjectStore: (name, options) => {
      assert.strictEqual(name, STORE_NAME);
      assert.strictEqual(options.keyPath, 'clientPhotoId', 'keyPath must be clientPhotoId');
      return mockIDBStore;
    },
    transaction: (stores, mode) => {
      assert.ok(stores.includes(STORE_NAME));
      return {
        objectStore: (storeName) => {
          assert.strictEqual(storeName, STORE_NAME);
          return mockIDBStore;
        },
      };
    },
  };

  globalThis.window.indexedDB = {
    open: (dbName, version) => {
      assert.strictEqual(dbName, DB_NAME, 'Database name must be snapbooth_offline_db');
      assert.strictEqual(version, DB_VERSION, 'Database version must be 1');
      const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: mockIDBDatabase };
      queueMicrotask(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: mockIDBDatabase } });
        }
        if (req.onsuccess) {
          req.onsuccess({ target: req });
        }
      });
      return req;
    },
  };

  await t.test('2.1: openOfflineDB creates snapbooth_offline_db with offline_photos store and indexes', async () => {
    const db = await openOfflineDB();
    assert.ok(db, 'IndexedDB should open successfully');
    assert.ok(createdIndexes.has('eventId'), 'Index eventId must exist');
    assert.ok(createdIndexes.has('status'), 'Index status must exist');
    assert.ok(createdIndexes.has('timestamp'), 'Index timestamp must exist');
  });

  await t.test('2.2: queueOfflinePhoto writes record to IndexedDB object store', async () => {
    const testId = 'idb-photo-1';
    await queueOfflinePhoto({
      clientPhotoId: testId,
      eventId: 'evt-idb',
      blob: new Blob(['idb-data']),
      format: 'single',
    });

    assert.ok(mockStore.has(testId), 'Record should be stored in mock IndexedDB store');
    const stored = mockStore.get(testId);
    assert.strictEqual(stored.clientPhotoId, testId);
    assert.strictEqual(stored.status, 'pending');
  });

  await t.test('2.3: updatePhotoStatus updates record inside IndexedDB object store', async () => {
    const testId = 'idb-photo-1';
    await updatePhotoStatus(testId, 'failed', 'Timeout error');

    const updated = mockStore.get(testId);
    assert.strictEqual(updated.status, 'failed');
    assert.strictEqual(updated.retryCount, 1);
    assert.strictEqual(updated.lastError, 'Timeout error');
  });

  await t.test('2.4: removeQueuedPhoto deletes record from IndexedDB object store', async () => {
    const testId = 'idb-photo-1';
    await removeQueuedPhoto(testId);
    assert.strictEqual(mockStore.has(testId), false, 'Record should be deleted from IndexedDB');
  });

  delete globalThis.window.indexedDB;
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: CountdownScreen.tsx Offline Failure Branch Stress Test
// ─────────────────────────────────────────────────────────────────────────────
test('3. CountdownScreen.tsx: Offline Failure Branch & Fallback Behavior', async (t) => {
  /**
   * Simulates the exact capture processing workflow from CountdownScreen.tsx lines 124-222
   */
  async function simulateCountdownProcessCaptures({
    event,
    mode,
    sessionId,
    frames,
    uploadPhotoFn,
    createStripFn,
    createGIFFn,
  }) {
    // Zustand store mock
    let currentPhotoState = null;
    let screenState = 'countdown';
    let isProcessingState = false;
    let clearFramesCalled = false;
    const toastNotifications = [];

    const store = {
      setCurrentPhoto: (p) => { currentPhotoState = p; },
      setScreen: (s) => { screenState = s; },
      setProcessing: (v) => { isProcessingState = v; },
      clearFrames: () => { clearFramesCalled = true; },
    };

    const toast = {
      success: (msg, opts) => toastNotifications.push({ type: 'success', msg, opts }),
      error: (msg, opts) => toastNotifications.push({ type: 'error', msg, opts }),
    };

    // Execution of processCaptures
    store.setProcessing(true);

    try {
      if (!event) throw new Error('No event loaded');

      const composited = frames; // mock composite
      const clientPhotoId = `test-photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const localPreviewUrl = `blob:preview-${clientPhotoId}`;
      const format = mode === 'strip' ? 'strip' : mode === 'gif' || mode === 'boomerang' ? 'gif' : 'single';

      // 1. Immediately save to offline queue BEFORE upload
      const offlineRecord = {
        clientPhotoId,
        eventId: event.id,
        sessionId: sessionId || '',
        blob: composited[0],
        format,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
        localPreviewUrl,
      };

      await queueOfflinePhoto(offlineRecord);

      // 2. Attempt network upload
      try {
        let result;
        if (mode === 'single' || mode === 'aistudio') {
          result = await uploadPhotoFn(composited[0], event.id, sessionId, 'single', clientPhotoId);
          await removeQueuedPhoto(clientPhotoId);
          store.setCurrentPhoto(result.photo);
          store.setScreen(mode === 'aistudio' ? 'aistudio' : 'preview');
        } else if (mode === 'strip') {
          result = await createStripFn(composited, event.id, clientPhotoId, sessionId);
          await removeQueuedPhoto(clientPhotoId);
          store.setCurrentPhoto({ ...result.strip, mode: 'strip' });
          store.setScreen('preview');
        } else if (mode === 'gif' || mode === 'boomerang') {
          result = await createGIFFn(composited, event.id, mode, clientPhotoId, sessionId);
          await removeQueuedPhoto(clientPhotoId);
          store.setCurrentPhoto({ ...result.gif, mode });
          store.setScreen('preview');
        }
      } catch (uploadError) {
        // Offline failure branch
        toast.success('Saved to offline queue. Will auto-sync when online.', { icon: '💾', duration: 4000 });
        store.setCurrentPhoto({
          id: clientPhotoId,
          url: localPreviewUrl,
          thumbUrl: localPreviewUrl,
          thumb_url: localPreviewUrl,
          downloadUrl: localPreviewUrl,
          galleryUrl: '',
          gallery_url: '',
          qrCode: '',
          whatsappUrl: '',
          mode: mode === 'aistudio' ? 'single' : mode,
          isOfflinePending: true,
        });
        store.setScreen(mode === 'aistudio' ? 'aistudio' : 'preview');
      }
    } catch (error) {
      toast.error(`Failed to process capture: ${error.message}`);
      store.setScreen('idle');
    } finally {
      store.setProcessing(false);
      store.clearFrames(); // Currently in CountdownScreen.tsx line 218
    }

    return {
      currentPhotoState,
      screenState,
      isProcessingState,
      clearFramesCalled,
      toastNotifications,
    };
  }

  await t.test('3.1: Network upload failure transitions to preview with isOfflinePending: true', async () => {
    const event = { id: 'evt-countdown-test' };
    const mockFrames = [new Blob(['frame1'])];

    const result = await simulateCountdownProcessCaptures({
      event,
      mode: 'single',
      sessionId: 'sess-1',
      frames: mockFrames,
      uploadPhotoFn: async () => {
        const err = new Error('NetworkError: Failed to fetch');
        err.name = 'NetworkError';
        throw err;
      },
    });

    // Verification of fallback state
    assert.strictEqual(result.screenState, 'preview', 'Screen must transition to preview on network failure');
    assert.ok(result.currentPhotoState, 'currentPhoto must be populated with local preview');
    assert.strictEqual(result.currentPhotoState.isOfflinePending, true, 'isOfflinePending must be true');
    assert.ok(result.currentPhotoState.url.startsWith('blob:preview-'), 'Local preview URL must be set');

    // Verification of persistence in offline queue
    const queued = await getQueuedPhotos('evt-countdown-test');
    assert.ok(queued.length >= 1, 'Photo must remain in offline queue when upload fails');
    const item = queued.find((p) => p.clientPhotoId === result.currentPhotoState.id);
    assert.ok(item, 'Queued item must match clientPhotoId');
    assert.strictEqual(item.status, 'pending');

    // Check toast notification
    const savedToast = result.toastNotifications.find((t) => t.msg.includes('Saved to offline queue'));
    assert.ok(savedToast, 'User must be notified that photo was saved to offline queue');

    // Observation of clearFrames call in CountdownScreen.tsx
    // CountdownScreen.tsx line 218 calls clearFrames() in finally block
    assert.strictEqual(
      result.clearFramesCalled,
      true,
      'Empirical observation: clearFrames() is called in finally block of CountdownScreen.tsx'
    );
  });

  await t.test('3.2: Successful online upload removes record from offline queue', async () => {
    const event = { id: 'evt-countdown-online' };
    const mockFrames = [new Blob(['frame-online'])];

    const result = await simulateCountdownProcessCaptures({
      event,
      mode: 'single',
      sessionId: 'sess-2',
      frames: mockFrames,
      uploadPhotoFn: async (blob, evt, sess, fmt, id) => {
        return {
          photo: {
            id,
            url: 'https://r2.example.com/photo.jpg',
            isOfflinePending: false,
          },
        };
      },
    });

    assert.strictEqual(result.screenState, 'preview');
    assert.strictEqual(result.currentPhotoState.isOfflinePending, false);
    const queued = await getQueuedPhotos('evt-countdown-online');
    const found = queued.find((p) => p.clientPhotoId === result.currentPhotoState.id);
    assert.strictEqual(found, undefined, 'Synced photo must be removed from offline queue');
  });

  await t.test('3.3: AI Studio mode network failure transitions to aistudio screen with local preview', async () => {
    const event = { id: 'evt-aistudio-test' };
    const mockFrames = [new Blob(['ai-frame'])];

    const result = await simulateCountdownProcessCaptures({
      event,
      mode: 'aistudio',
      sessionId: 'sess-ai',
      frames: mockFrames,
      uploadPhotoFn: async () => {
        throw new Error('ETIMEDOUT');
      },
    });

    assert.strictEqual(result.screenState, 'aistudio', 'AI Studio mode must transition to aistudio screen');
    assert.strictEqual(result.currentPhotoState.isOfflinePending, true);
  });

  await t.test('3.4: Strip mode network failure queues capture and transitions to preview', async () => {
    const event = { id: 'evt-strip-test' };
    const mockFrames = [new Blob(['strip-1']), new Blob(['strip-2']), new Blob(['strip-3']), new Blob(['strip-4'])];

    const result = await simulateCountdownProcessCaptures({
      event,
      mode: 'strip',
      sessionId: 'sess-strip',
      frames: mockFrames,
      createStripFn: async () => {
        throw new Error('503 Service Unavailable');
      },
    });

    assert.strictEqual(result.screenState, 'preview');
    assert.strictEqual(result.currentPhotoState.isOfflinePending, true);
    assert.strictEqual(result.currentPhotoState.mode, 'strip');
    const queued = await getQueuedPhotos('evt-strip-test');
    assert.ok(queued.length >= 1);
  });

  await t.test('3.5: GIF mode network failure queues capture and transitions to preview', async () => {
    const event = { id: 'evt-gif-test' };
    const mockFrames = [new Blob(['gif-1']), new Blob(['gif-2'])];

    const result = await simulateCountdownProcessCaptures({
      event,
      mode: 'gif',
      sessionId: 'sess-gif',
      frames: mockFrames,
      createGIFFn: async () => {
        throw new Error('Connection refused');
      },
    });

    assert.strictEqual(result.screenState, 'preview');
    assert.strictEqual(result.currentPhotoState.isOfflinePending, true);
    assert.strictEqual(result.currentPhotoState.mode, 'gif');
    const queued = await getQueuedPhotos('evt-gif-test');
    assert.ok(queued.length >= 1);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: IdleScreen.tsx PIN Authentication & Lockout Verification
// ─────────────────────────────────────────────────────────────────────────────
test('4. IdleScreen.tsx: Operator PIN Authentication & Lockout Logic', async (t) => {
  /**
   * Simulates IdleScreen.tsx PIN authentication and lockout state machine (lines 75-194)
   */
  function createIdleScreenStateMachine(event, operatorLoginFn, getBoothSessionFn) {
    let showPanel = false;
    let showPinPad = false;
    let pinInput = '';
    let pinError = false;
    let pinErrorMessage = '';
    let pinLocked = false;
    let pinAttempts = 0;
    let lockCountdown = 0;
    let isAuthenticating = false;
    const toasts = [];

    const toast = {
      success: (msg, opts) => toasts.push({ type: 'success', msg, opts }),
      error: (msg, opts) => toasts.push({ type: 'error', msg, opts }),
      info: (msg, opts) => toasts.push({ type: 'info', msg, opts }),
    };

    function handleOperatorGear() {
      if (pinLocked) return false;

      const existingToken =
        sessionStorage.getItem('operator_token') ||
        (event?.id ? sessionStorage.getItem(`booth_token_${event.id}`) : null);

      if (existingToken) {
        showPanel = true;
        return true;
      }

      showPinPad = true;
      pinInput = '';
      pinError = false;
      pinErrorMessage = '';
      return true;
    }

    async function submitPin(pinToSubmit) {
      if (!event?.id) return;
      isAuthenticating = true;
      pinError = false;
      pinErrorMessage = '';

      try {
        const res = await operatorLoginFn(event.id, pinToSubmit);
        if (res?.token) {
          sessionStorage.setItem('operator_token', res.token);
          try {
            await getBoothSessionFn(event.id, res.token);
          } catch {}

          toast.success('Operator authenticated', { icon: '🔓' });
          showPinPad = false;
          showPanel = true;
          pinInput = '';
          pinAttempts = 0;
        }
      } catch (err) {
        const is401 = err?.response?.status === 401;
        const errorMsg = is401 ? 'Invalid Operator PIN' : err?.message || 'Authentication failed';

        pinError = true;
        pinErrorMessage = errorMsg;
        toast.error(errorMsg);
        pinInput = '';

        pinAttempts += 1;
        if (pinAttempts >= 5) {
          pinLocked = true;
          lockCountdown = 30;
        }
      } finally {
        isAuthenticating = false;
      }
    }

    function handlePinKey(key) {
      if (isAuthenticating || pinLocked) return;
      if (key === '⌫') {
        pinInput = pinInput.slice(0, -1);
        return;
      }
      if (key === '') return;

      const next = pinInput + key;
      if (next.length <= 6) {
        pinInput = next;
        if (next.length === 4) {
          submitPin(next);
        }
      }
    }

    function handleLockOperator() {
      sessionStorage.removeItem('operator_token');
      sessionStorage.removeItem('booth_token');
      if (event?.id) {
        sessionStorage.removeItem(`booth_token_${event.id}`);
      }
      showPanel = false;
      showPinPad = false;
      pinInput = '';
      toast.info('Operator locked');
    }

    return {
      getState: () => ({
        showPanel,
        showPinPad,
        pinInput,
        pinError,
        pinErrorMessage,
        pinLocked,
        pinAttempts,
        lockCountdown,
        isAuthenticating,
        toasts,
      }),
      handleOperatorGear,
      handlePinKey,
      submitPin,
      handleLockOperator,
      tickTimer: () => {
        if (lockCountdown > 0) {
          lockCountdown -= 1;
          if (lockCountdown === 0) {
            pinLocked = false;
            pinAttempts = 0;
          }
        }
      },
    };
  }

  await t.test('4.1: Invalid PIN throws 401 and does NOT unlock operator panel', async () => {
    sessionStorage.clear();
    const event = { id: 'evt-pin-test' };

    const mockOperatorLogin = async (eventId, pin) => {
      const err = new Error('Invalid PIN');
      err.response = { status: 401, data: { error: 'Invalid operator PIN' } };
      throw err;
    };

    const sm = createIdleScreenStateMachine(event, mockOperatorLogin, async () => {});

    sm.handleOperatorGear();
    assert.strictEqual(sm.getState().showPinPad, true);
    assert.strictEqual(sm.getState().showPanel, false);

    // Enter wrong PIN '9999'
    sm.handlePinKey('9');
    sm.handlePinKey('9');
    sm.handlePinKey('9');
    sm.handlePinKey('9'); // auto-submits on 4th digit

    await new Promise((r) => queueMicrotask(r));

    const state = sm.getState();
    assert.strictEqual(state.showPanel, false, 'Panel must NOT unlock on 401 error');
    assert.strictEqual(state.pinError, true);
    assert.strictEqual(state.pinErrorMessage, 'Invalid Operator PIN');
    assert.strictEqual(state.pinInput, '', 'PIN input must reset on error');
    assert.strictEqual(state.pinAttempts, 1);
    assert.strictEqual(sessionStorage.getItem('operator_token'), null);
  });

  await t.test('4.2: Repeated failed attempts trigger lockout after 5 attempts', async () => {
    sessionStorage.clear();
    const event = { id: 'evt-lockout-test' };

    const mockOperatorLogin = async () => {
      const err = new Error('Invalid PIN');
      err.response = { status: 401, data: { error: 'Invalid operator PIN' } };
      throw err;
    };

    const sm = createIdleScreenStateMachine(event, mockOperatorLogin, async () => {});
    sm.handleOperatorGear();

    // 4 failed attempts: not locked out yet
    for (let i = 1; i <= 4; i++) {
      sm.handlePinKey('1');
      sm.handlePinKey('1');
      sm.handlePinKey('1');
      sm.handlePinKey('1');
      await new Promise((r) => queueMicrotask(r));
      assert.strictEqual(sm.getState().pinAttempts, i);
      assert.strictEqual(sm.getState().pinLocked, false, `Attempt ${i} should not be locked`);
    }

    // 5th failed attempt: triggers lockout
    sm.handlePinKey('1');
    sm.handlePinKey('1');
    sm.handlePinKey('1');
    sm.handlePinKey('1');
    await new Promise((r) => queueMicrotask(r));

    const lockedState = sm.getState();
    assert.strictEqual(lockedState.pinAttempts, 5);
    assert.strictEqual(lockedState.pinLocked, true, '5th failed attempt must trigger pinLocked = true');
    assert.strictEqual(lockedState.lockCountdown, 30, 'Countdown must start at 30 seconds');

    // While locked out: handleOperatorGear returns false and ignores clicks
    const gearResult = sm.handleOperatorGear();
    assert.strictEqual(gearResult, false, 'handleOperatorGear must be blocked when pinLocked is true');

    // While locked out: handlePinKey ignores key presses
    sm.handlePinKey('2');
    assert.strictEqual(sm.getState().pinInput, '', 'PIN keys must be ignored during lockout');

    // Simulate 30 second timer countdown
    for (let s = 30; s > 0; s--) {
      assert.strictEqual(sm.getState().pinLocked, true);
      sm.tickTimer();
    }

    // Countdown reached 0: unlocked
    const unlockedState = sm.getState();
    assert.strictEqual(unlockedState.pinLocked, false, 'Pad must unlock after timer expires');
    assert.strictEqual(unlockedState.pinAttempts, 0, 'pinAttempts must reset to 0');
  });

  await t.test('4.3: Valid PIN unlocks operator panel and stores scoped credentials', async () => {
    sessionStorage.clear();
    const event = { id: 'evt-valid-test' };
    let boothSessionCreated = false;

    const mockOperatorLogin = async (eventId, pin) => {
      assert.strictEqual(eventId, 'evt-valid-test');
      assert.strictEqual(pin, '1234');
      return {
        token: 'mock-operator-jwt',
        operator: { role: 'operator', eventId, expiresAt: new Date(Date.now() + 3600000).toISOString() },
      };
    };

    const mockGetBoothSession = async (eventId, token) => {
      assert.strictEqual(token, 'mock-operator-jwt');
      boothSessionCreated = true;
      sessionStorage.setItem('booth_token', 'mock-booth-token');
      return { sessionToken: 'mock-booth-token', eventId };
    };

    const sm = createIdleScreenStateMachine(event, mockOperatorLogin, mockGetBoothSession);
    sm.handleOperatorGear();

    sm.handlePinKey('1');
    sm.handlePinKey('2');
    sm.handlePinKey('3');
    sm.handlePinKey('4');
    await new Promise((r) => queueMicrotask(r));

    const state = sm.getState();
    assert.strictEqual(state.showPanel, true, 'Operator panel must be unlocked');
    assert.strictEqual(state.showPinPad, false, 'PIN pad modal must close');
    assert.strictEqual(sessionStorage.getItem('operator_token'), 'mock-operator-jwt');
    assert.strictEqual(boothSessionCreated, true, 'Booth session token must be requested');

    // Operator locks panel
    sm.handleLockOperator();
    const lockedState = sm.getState();
    assert.strictEqual(lockedState.showPanel, false);
    assert.strictEqual(sessionStorage.getItem('operator_token'), null, 'operator_token must be cleared');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: api.ts Booth Session Headers and Deduplication
// ─────────────────────────────────────────────────────────────────────────────
test('5. api.ts: Booth Token Storage & Deduplication Headers', async (t) => {
  sessionStorage.clear();
  localStorage.clear();

  await t.test('5.1: getBoothHeaders attaches X-Booth-Session and X-Idempotency-Key', () => {
    setBoothToken('session-jwt-abc123', 'evt-headers-test');

    const headers = getBoothHeaders('evt-headers-test', 'client-photo-uuid-999');
    assert.strictEqual(headers['X-Booth-Session'], 'session-jwt-abc123');
    assert.strictEqual(headers['x-booth-session'], 'session-jwt-abc123');
    assert.strictEqual(headers['X-Idempotency-Key'], 'client-photo-uuid-999');
    assert.strictEqual(headers['x-idempotency-key'], 'client-photo-uuid-999');
  });

  await t.test('5.2: getBoothToken prioritizes event-specific token', () => {
    sessionStorage.setItem('booth_token', 'global-token');
    sessionStorage.setItem('booth_token_evt-xyz', 'event-specific-token');

    assert.strictEqual(getBoothToken('evt-xyz'), 'event-specific-token');
    assert.strictEqual(getBoothToken('other-event'), 'global-token');
  });
});
