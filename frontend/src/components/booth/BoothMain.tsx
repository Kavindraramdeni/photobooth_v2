'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { processOfflineQueue, getPendingCaptures } from '@/lib/offlineQueue';
import { uploadPhoto } from '@/lib/api';
import { IdleScreen } from './IdleScreen';
import { StyleScreen } from './StyleScreen';
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

  const screens: Record<string, React.ReactNode> = {
    idle: <IdleScreen />,
    style: <StyleScreen />,
    countdown: <CountdownScreen />,
    capture: <CountdownScreen />,
    preview: <PreviewScreen />,
    ai: <AIStudioScreen />,
    aistudio: <AIStudioScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />,
  };

  const themeClass = themeMode === 'light' ? 'theme-light' : themeMode === 'champagne' ? 'theme-champagne' : 'theme-dark';

  return (
    <div
      className={`booth-container relative ${themeClass}`}
      onTouchStart={resetTimeout}
      onClick={resetTimeout}
    >
      {/* Background Layer: Rich Brand Indigo-to-Plum Gradient by default, or Apple Light Canvas */}
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
          {/* Heavy opaque scrim so nothing shows through messily */}
          <div
            className={`absolute inset-0 ${
              themeMode === 'light'
                ? 'bg-white/80 backdrop-blur-md'
                : 'bg-[#0c0d24]/85 backdrop-blur-md'
            }`}
          />
        </div>
      ) : themeMode === 'light' ? (
        /* Light Theme Canvas */
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-b from-[#ffffff] via-[#f4f6fa] to-[#e9ecf4]">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-15"
            style={{ background: primaryColor }}
          />
          <div className="absolute -bottom-32 right-10 w-[500px] h-[500px] rounded-full blur-[140px] opacity-10 bg-indigo-300" />
        </div>
      ) : (
        /* Rich Brand-Tinted Gradient: Deep Indigo to Plum (not black) */
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-br from-[#0c0d24] via-[#161233] to-[#250d38]">
          <div
            className="absolute -top-24 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-25"
            style={{ background: primaryColor }}
          />
          <div className="absolute -bottom-24 right-1/4 w-[550px] h-[550px] rounded-full blur-[150px] opacity-20 bg-purple-900" />
        </div>
      )}

      <FlashOverlay />

      {/* Screen Viewport with clean 250ms crossfade */}
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
