'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { processOfflineQueue, getPendingCaptures } from '@/lib/offlineQueue';
import { uploadPhoto } from '@/lib/api';
import { IdleScreen } from './IdleScreen';
import { CountdownScreen } from './CountdownScreen';
import { PreviewScreen } from './PreviewScreen';
import { AIStudioScreen } from './AIStudioScreen';
import { ShareScreen } from './ShareScreen';
import { FlashOverlay } from './FlashOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

export function BoothMain() {
  const { screen, event, resetSession, setScreen } = useBoothStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Background sync for offline photo queue
  useEffect(() => {
    if (!event) return;

    const triggerSync = async () => {
      try {
        const pending = await getPendingCaptures(event.id);
        setPendingSyncCount(pending.length);

        if (pending.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
          await processOfflineQueue(
            event.id,
            async (item) => {
              await uploadPhoto(item.blobData, item.eventId, item.sessionId || '', item.mode, item.clientCaptureId);
            },
            (remaining) => setPendingSyncCount(remaining)
          );
        }
      } catch (syncErr) {
        console.warn('[BoothMain] Background sync error:', syncErr);
      }
    };

    triggerSync();
    window.addEventListener('online', triggerSync);
    const interval = setInterval(triggerSync, 30000); // Check every 30s

    return () => {
      window.removeEventListener('online', triggerSync);
      clearInterval(interval);
    };
  }, [event]);

  // Connect to Socket.IO with authenticated handshake
  useEffect(() => {
    if (!event) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

    const boothToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem(`booth_token_${event.id}`) || localStorage.getItem(`booth_token_${event.id}`)
        : null;

    const socket = io(socketUrl, {
      auth: { token: boothToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
      timeout: 15000,
    });
    socketRef.current = socket;

    socket.emit('join-event', event.id);

    socket.on('ai-status', ({ message }: { message: string }) => {
      useBoothStore.getState().setAIProgress(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [event]);

  // Session timeout - auto-reset after inactivity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const timeout = (event?.settings.sessionTimeout || 60) * 1000;

    if (screen !== 'idle') {
      timeoutRef.current = setTimeout(() => {
        resetSession();
      }, timeout);
    }
  }, [screen, event, resetSession]);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [screen, resetTimeout]);

  // Prevent context menu and text selection on iPad
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
    };
  }, []);

  const screens = {
    idle: <IdleScreen />,
    countdown: <CountdownScreen />,
    capture: <CountdownScreen />, // same component handles capture state
    preview: <PreviewScreen />,
    ai: <AIStudioScreen />,      // legacy 'ai' screen now uses AIStudioScreen
    aistudio: <AIStudioScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />, // print is part of share screen
  };

  return (
    <div className="booth-container relative" onTouchStart={resetTimeout} onClick={resetTimeout}>
      <FlashOverlay />
      {pendingSyncCount > 0 && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium backdrop-blur-md animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Offline Sync: {pendingSyncCount} photo{pendingSyncCount > 1 ? 's' : ''} queued
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          {screens[screen] || screens.idle}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
