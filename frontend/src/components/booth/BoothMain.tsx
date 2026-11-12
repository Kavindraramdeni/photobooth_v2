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

  const branding = event?.branding;
  const themeMode = (branding?.themeMode as string) || 'light';
  const wallpaperUrl = (branding?.wallpaperUrl as string) || (branding?.idleMediaUrl as string) || null;
  const isVideo = wallpaperUrl?.match(/\.(mp4|webm|mov)(\?|$)/i);
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';

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
              await uploadPhoto(item.blobData || item.blob, item.eventId, item.sessionId || '', item.mode, item.clientCaptureId);
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
    const interval = setInterval(triggerSync, 30000);

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

  // Session timeout
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const timeout = (event?.settings?.sessionTimeout || 60) * 1000;

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
    capture: <CountdownScreen />,
    preview: <PreviewScreen />,
    ai: <AIStudioScreen />,
    aistudio: <AIStudioScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />,
  };

  const themeClass = themeMode === 'dark' ? 'theme-dark' : themeMode === 'champagne' ? 'theme-champagne' : 'theme-light';

  return (
    <div
      className={`booth-container relative ${themeClass}`}
      onTouchStart={resetTimeout}
      onClick={resetTimeout}
    >
      {/* Universal Background Layer: Event Wallpaper or Apple Light Studio */}
      {wallpaperUrl ? (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {isVideo ? (
            <video
              src={wallpaperUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={wallpaperUrl}
              alt="Event Wallpaper"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Frosted glass overlay to ensure readability */}
          <div
            className={`absolute inset-0 ${
              themeMode === 'dark'
                ? 'bg-black/55 backdrop-blur-[6px]'
                : 'bg-white/60 backdrop-blur-[6px]'
            }`}
          />
        </div>
      ) : (
        /* Clean Apple Light Studio Canvas with Soft Silver Radial Mesh */
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-b from-[#ffffff] via-[#f4f6fa] to-[#e9ecf4]">
          {/* Subtle soft silver orbs */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-15"
            style={{ background: primaryColor }}
          />
          <div className="absolute -bottom-32 right-10 w-[500px] h-[500px] rounded-full blur-[140px] opacity-10 bg-blue-400" />
          <div className="absolute top-1/3 -left-20 w-[450px] h-[450px] rounded-full blur-[140px] opacity-10 bg-purple-300" />
          {/* Micro dot pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#00000008_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>
      )}

      <FlashOverlay />

      {pendingSyncCount > 0 && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold backdrop-blur-md animate-pulse shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Offline Sync: {pendingSyncCount} photo{pendingSyncCount > 1 ? 's' : ''} queued
        </div>
      )}

      {/* Screen Viewport */}
      <div className="relative z-10 w-full h-full flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
          >
            {screens[screen] || screens.idle}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
