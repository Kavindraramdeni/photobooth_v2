'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingCount, syncQueuedPhotos } from '@/lib/offlineQueue';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<{ synced: number; failed: number }>;
}

/**
 * React hook to monitor network connectivity, track pending offline photos,
 * and automatically drain the IndexedDB queue with exponential backoff on reconnection.
 */
export function useOfflineSync(eventId?: string): OfflineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isSyncingRef = useRef<boolean>(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount(eventId);
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [eventId]);

  const triggerSync = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    if (isSyncingRef.current) {
      return { synced: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await syncQueuedPhotos(undefined, eventId, (remaining) => {
        setPendingCount(remaining);
      });

      if (result.synced > 0) {
        setLastSyncedAt(new Date());
      }

      await refreshCount();
      return result;
    } catch (err) {
      console.warn('[useOfflineSync] Error during background synchronization:', err);
      return { synced: 0, failed: 0 };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [eventId, refreshCount]);

  useEffect(() => {
    // Initial pending count scan
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync upon reconnection
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Periodic queue check every 30 seconds
      const timer = setInterval(() => {
        refreshCount().then((count) => {
          if (count > 0 && navigator.onLine && !isSyncingRef.current) {
            triggerSync();
          }
        });
      }, 30000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(timer);
      };
    }
  }, [refreshCount, triggerSync]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    triggerSync,
  };
}
