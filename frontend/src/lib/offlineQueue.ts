/**
 * SnapBooth Kiosk Offline Capture Queue & Auto-Sync Engine
 * Database: snapbooth_offline_db (Version 1)
 * Object store: offline_photos (keyPath: clientPhotoId)
 * Provides persistent IndexedDB storage to guarantee zero photo loss
 * during network dropouts, with automatic background sync and exponential backoff.
 */

import { uploadPhoto, createStrip, createGIF } from './api';

export interface OfflinePhotoRecord {
  clientPhotoId: string;
  eventId: string;
  blob: Blob;
  format: 'single' | 'strip' | 'gif';
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  localPreviewUrl?: string;
  lastError?: string;
  sessionId?: string;
  // Compatibility aliases
  clientCaptureId?: string;
  blobData?: Blob;
  mode?: string;
}

// Backward-compatible type for existing consumers
export type QueuedPhoto = OfflinePhotoRecord;

export const DB_NAME = 'snapbooth_offline_db';
export const DB_VERSION = 1;
export const STORE_NAME = 'offline_photos';

// In-memory fallback if IndexedDB is unavailable (SSR, private browsing restricted, etc.)
const memoryStore = new Map<string, OfflinePhotoRecord>();

let isSyncInProgress = false;

/**
 * Open IndexedDB connection safely
 */
export function openOfflineDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'clientPhotoId' });
          store.createIndex('eventId', 'eventId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('[OfflineQueue] IndexedDB open error, falling back to in-memory store:', request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('[OfflineQueue] IndexedDB blocked');
        resolve(null);
      };
    } catch (err) {
      console.warn('[OfflineQueue] IndexedDB initialization exception:', err);
      resolve(null);
    }
  });
}

/**
 * Normalizes an incoming record ensuring clientPhotoId, format, and defaults are populated
 */
function normalizeRecord(
  record: Partial<OfflinePhotoRecord> & { clientPhotoId?: string; clientCaptureId?: string; blob?: Blob; blobData?: Blob }
): OfflinePhotoRecord {
  const id = record.clientPhotoId || record.clientCaptureId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const blob = record.blob || record.blobData || new Blob([], { type: 'image/jpeg' });
  const rawFormat = (record.format || record.mode || 'single').toLowerCase();
  const format: 'single' | 'strip' | 'gif' =
    rawFormat === 'strip' ? 'strip' : rawFormat === 'gif' || rawFormat === 'boomerang' ? 'gif' : 'single';

  return {
    clientPhotoId: id,
    clientCaptureId: id,
    eventId: record.eventId || '',
    sessionId: record.sessionId || '',
    blob,
    blobData: blob,
    format,
    mode: format,
    timestamp: record.timestamp || Date.now(),
    retryCount: record.retryCount || 0,
    status: record.status || 'pending',
    localPreviewUrl: record.localPreviewUrl,
    lastError: record.lastError,
  };
}

/**
 * Queue a photo capture into IndexedDB
 */
export async function queueOfflinePhoto(
  record: Partial<OfflinePhotoRecord> & { clientPhotoId?: string; clientCaptureId?: string }
): Promise<OfflinePhotoRecord> {
  const item = normalizeRecord(record);

  // Always update in-memory fallback
  memoryStore.set(item.clientPhotoId, item);

  const db = await openOfflineDB();
  if (!db) {
    return item;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);

      req.onsuccess = () => resolve(item);
      req.onerror = () => {
        console.warn('[OfflineQueue] put error in IndexedDB:', req.error);
        resolve(item);
      };
    } catch (err) {
      console.warn('[OfflineQueue] put transaction exception:', err);
      resolve(item);
    }
  });
}

/**
 * Retrieve queued photos, optionally filtered by eventId
 */
export async function getQueuedPhotos(eventId?: string): Promise<OfflinePhotoRecord[]> {
  const db = await openOfflineDB();

  if (!db) {
    let list = Array.from(memoryStore.values());
    if (eventId) {
      list = list.filter((p) => p.eventId === eventId);
    }
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        let results = (req.result as OfflinePhotoRecord[]) || [];
        if (eventId) {
          results = results.filter((p) => p.eventId === eventId);
        }
        resolve(results.sort((a, b) => a.timestamp - b.timestamp));
      };
      req.onerror = () => {
        let list = Array.from(memoryStore.values());
        if (eventId) list = list.filter((p) => p.eventId === eventId);
        resolve(list.sort((a, b) => a.timestamp - b.timestamp));
      };
    } catch (err) {
      let list = Array.from(memoryStore.values());
      if (eventId) list = list.filter((p) => p.eventId === eventId);
      resolve(list.sort((a, b) => a.timestamp - b.timestamp));
    }
  });
}

/**
 * Remove a photo from IndexedDB when successfully synced
 */
export async function removeQueuedPhoto(clientPhotoId: string): Promise<void> {
  memoryStore.delete(clientPhotoId);

  const db = await openOfflineDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clientPhotoId);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Update the status, retry count, or last error of a queued photo
 */
export async function updatePhotoStatus(
  clientPhotoId: string,
  status: 'pending' | 'syncing' | 'failed',
  error?: string
): Promise<void> {
  // Update in-memory
  const mem = memoryStore.get(clientPhotoId);
  if (mem) {
    mem.status = status;
    if (status === 'failed') mem.retryCount = (mem.retryCount || 0) + 1;
    if (error !== undefined) mem.lastError = error;
  }

  const db = await openOfflineDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(clientPhotoId);

      getReq.onsuccess = () => {
        const item = getReq.result as OfflinePhotoRecord | undefined;
        if (!item) return resolve();

        item.status = status;
        if (status === 'failed') {
          item.retryCount = (item.retryCount || 0) + 1;
        }
        if (error !== undefined) {
          item.lastError = error;
        }

        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => resolve();
      };
      getReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Get the count of pending or failing photos in the queue
 */
export async function getPendingCount(eventId?: string): Promise<number> {
  const photos = await getQueuedPhotos(eventId);
  return photos.filter((p) => p.status === 'pending' || p.status === 'failed' || p.status === 'syncing').length;
}

/**
 * Sequential background sync of all pending queued photos with exponential backoff on retry.
 * apiClient parameter is optional; defaults to project upload helpers.
 */
export async function syncQueuedPhotos(
  apiClient?: {
    uploadPhoto?: typeof uploadPhoto;
    createStrip?: typeof createStrip;
    createGIF?: typeof createGIF;
  },
  eventId?: string,
  onProgress?: (pendingRemaining: number) => void
): Promise<{ synced: number; failed: number }> {
  // Check online status in browser
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  // Prevent duplicate concurrent sync execution
  if (isSyncInProgress) {
    return { synced: 0, failed: 0 };
  }

  isSyncInProgress = true;

  try {
    const all = await getQueuedPhotos(eventId);
    const pending = all.filter((p) => p.status === 'pending' || p.status === 'failed');

    if (pending.length === 0) {
      onProgress?.(0);
      return { synced: 0, failed: 0 };
    }

    const uploader = apiClient?.uploadPhoto || uploadPhoto;
    const stripUploader = apiClient?.createStrip || createStrip;
    const gifUploader = apiClient?.createGIF || createGIF;

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await updatePhotoStatus(item.clientPhotoId, 'syncing');

        const uploadBlob = item.blob || item.blobData;

        if (item.format === 'strip' && stripUploader) {
          await stripUploader([uploadBlob], item.eventId, item.clientPhotoId, item.sessionId);
        } else if (item.format === 'gif' && gifUploader) {
          await gifUploader([uploadBlob], item.eventId, 'gif', item.clientPhotoId, item.sessionId);
        } else {
          await uploader(uploadBlob, item.eventId, item.sessionId || '', item.format || 'single', item.clientPhotoId);
        }

        await removeQueuedPhoto(item.clientPhotoId);
        synced++;
      } catch (err: any) {
        failed++;
        const errMsg = err?.response?.data?.error || err?.message || 'Sync upload error';
        await updatePhotoStatus(item.clientPhotoId, 'failed', errMsg);

        // Exponential backoff pause on consecutive failures
        const backoffMs = Math.min(1000 * Math.pow(2, (item.retryCount || 0) + 1), 10000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    const remainingCount = await getPendingCount(eventId);
    onProgress?.(remainingCount);

    return { synced, failed };
  } finally {
    isSyncInProgress = false;
  }
}

// ── Backward-Compatibility Wrappers ─────────────────────────────────────────

export async function enqueueCapture(photo: {
  clientCaptureId?: string;
  clientPhotoId?: string;
  eventId: string;
  sessionId?: string;
  mode?: string;
  format?: 'single' | 'strip' | 'gif';
  blobData?: Blob;
  blob?: Blob;
  mimeType?: string;
}): Promise<OfflinePhotoRecord> {
  const clientPhotoId = photo.clientPhotoId || photo.clientCaptureId || '';
  const blob = photo.blob || photo.blobData || new Blob([], { type: photo.mimeType || 'image/jpeg' });
  const format = (photo.format || (photo.mode === 'strip' ? 'strip' : photo.mode === 'gif' || photo.mode === 'boomerang' ? 'gif' : 'single'));

  return queueOfflinePhoto({
    clientPhotoId,
    clientCaptureId: clientPhotoId,
    eventId: photo.eventId,
    sessionId: photo.sessionId,
    blob,
    blobData: blob,
    format,
    mode: format,
  });
}

export async function getPendingCaptures(eventId?: string): Promise<OfflinePhotoRecord[]> {
  const all = await getQueuedPhotos(eventId);
  return all.filter((p) => p.status === 'pending' || p.status === 'failed');
}

export async function removeSyncedCapture(clientCaptureId: string): Promise<void> {
  return removeQueuedPhoto(clientCaptureId);
}

export async function updateCaptureState(
  clientCaptureId: string,
  updates: Partial<Pick<OfflinePhotoRecord, 'status' | 'retryCount' | 'lastError'>>
): Promise<void> {
  if (updates.status) {
    return updatePhotoStatus(clientCaptureId, updates.status, updates.lastError);
  }
}

export async function processOfflineQueue(
  eventId: string,
  uploadHandler?: (item: OfflinePhotoRecord) => Promise<any>,
  onProgress?: (pendingCount: number) => void
): Promise<{ synced: number; failed: number }> {
  if (uploadHandler) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
        await updatePhotoStatus(item.clientPhotoId, 'syncing');
        await uploadHandler(item);
        await removeQueuedPhoto(item.clientPhotoId);
        synced++;
      } catch (err: any) {
        failed++;
        await updatePhotoStatus(item.clientPhotoId, 'failed', err?.message || 'Sync error');
      }
    }

    const remaining = await getPendingCount(eventId);
    onProgress?.(remaining);
    return { synced, failed };
  }

  return syncQueuedPhotos(undefined, eventId, onProgress);
}
