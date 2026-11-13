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
  // Use uploaded wallpaper or idle media, or default to the ambient background video
  const userMediaUrl = (branding?.wallpaperUrl as string) || (branding?.idleMediaUrl as string) || null;
  const activeMediaUrl = userMediaUrl || '/video/snapbooth.mp4';
  const isVideo = Boolean(activeMediaUrl?.match(/\.(mp4|webm|mov)(\?|$)/i));
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
      {/* Background Media: User wallpaper / video or default looping video */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
        {isVideo ? (
          <video
            src={activeMediaUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeMediaUrl}
            alt="Event Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Subtle, translucent scrim so background image/video is completely visible while text stays crisp */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/35 pointer-events-none" />
      </div>

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
