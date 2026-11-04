/**
 * SnapBooth Kiosk Offline Capture Queue & Auto-Sync
 * Uses client-side IndexedDB to guarantee zero photo loss during internet interruptions.
 */

export interface QueuedPhoto {
  clientCaptureId: string;
  eventId: string;
  sessionId?: string;
  mode: 'single' | 'burst' | 'gif' | 'strip';
  blobData: Blob;
  mimeType: string;
  timestamp: number;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'SnapBoothOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'photo_captures';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'clientCaptureId' });
        store.createIndex('eventId', 'eventId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a captured photo into IndexedDB
 */
export async function enqueueCapture(photo: Omit<QueuedPhoto, 'status' | 'retryCount' | 'timestamp'>): Promise<QueuedPhoto> {
  const db = await openDB();
  const queuedItem: QueuedPhoto = {
    ...photo,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(queuedItem);

    request.onsuccess = () => resolve(queuedItem);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending captures for an event
 */
export async function getPendingCaptures(eventId?: string): Promise<QueuedPhoto[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = (request.result as QueuedPhoto[]) || [];
        results = results.filter((p) => p.status === 'pending' || p.status === 'failed');
        if (eventId) {
          results = results.filter((p) => p.eventId === eventId);
        }
        resolve(results.sort((a, b) => a.timestamp - b.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] Failed to get pending captures:', err);
    return [];
  }
}

/**
 * Mark item status or remove on success
 */
export async function removeSyncedCapture(clientCaptureId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(clientCaptureId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] Failed to delete synced capture:', err);
  }
}

/**
 * Update capture retry state
 */
export async function updateCaptureState(
  clientCaptureId: string,
  updates: Partial<Pick<QueuedPhoto, 'status' | 'retryCount' | 'lastError'>>
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(clientCaptureId);

      getReq.onsuccess = () => {
        const item = getReq.result as QueuedPhoto | undefined;
        if (!item) return resolve();
        const updated = { ...item, ...updates };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] Update capture error:', err);
  }
}

/**
 * Synchronize all pending captures to the backend
 */
export async function processOfflineQueue(
  eventId: string,
  uploadHandler: (item: QueuedPhoto) => Promise<any>,
  onProgress?: (pendingCount: number) => void
): Promise<{ synced: number; failed: number }> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingCaptures(eventId);
  if (pending.length === 0) {
    onProgress?.(0);
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await updateCaptureState(item.clientCaptureId, { status: 'uploading' });
      await uploadHandler(item);
      await removeSyncedCapture(item.clientCaptureId);
      synced++;
    } catch (err: any) {
      failed++;
      await updateCaptureState(item.clientCaptureId, {
        status: 'failed',
        retryCount: item.retryCount + 1,
        lastError: err?.message || 'Network error',
      });
    }
  }

  const remaining = await getPendingCaptures(eventId);
  onProgress?.(remaining.length);

  return { synced, failed };
}
