'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useBoothStore } from '@/lib/store';
import { IdleScreen } from './IdleScreen';
import { CountdownScreen } from './CountdownScreen';
import { PreviewScreen } from './PreviewScreen';
import { AIScreen } from './AIScreen';
import { ShareScreen } from './ShareScreen';
import { FlashOverlay } from './FlashOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

export function BoothMain() {
  const { screen, event, resetSession } = useBoothStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ─── WAKE LOCK — keeps iPad screen on during event ──────────────────────
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Wake lock not supported or denied — not critical
      }
    }

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // ─── FULLSCREEN KIOSK MODE ───────────────────────────────────────────────
  useEffect(() => {
    async function enterFullscreen() {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen && !document.fullscreenElement) {
          await el.requestFullscreen({ navigationUI: 'hide' });
        } else if ((el as any).webkitRequestFullscreen && !(document as any).webkitFullscreenElement) {
          // Safari / iOS
          await (el as any).webkitRequestFullscreen();
        }
      } catch {
        // Fullscreen blocked by browser — PWA mode already handles this
      }
    }

    // Enter fullscreen on first touch (required by browsers for autoplay/fullscreen)
    const handleFirstTouch = () => {
      enterFullscreen();
      document.removeEventListener('touchstart', handleFirstTouch);
      document.removeEventListener('click', handleFirstTouch);
    };

    document.addEventListener('touchstart', handleFirstTouch, { passive: true });
    document.addEventListener('click', handleFirstTouch);

    return () => {
      document.removeEventListener('touchstart', handleFirstTouch);
      document.removeEventListener('click', handleFirstTouch);
    };
  }, []);

  // ─── SOCKET.IO for real-time admin updates ────────────────────────────────
  useEffect(() => {
    if (!event) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    socketRef.current = socket;
    socket.emit('join-event', event.id);

    socket.on('ai-status', ({ message }: { message: string }) => {
      useBoothStore.getState().setAIProgress(message);
    });

    return () => { socket.disconnect(); };
  }, [event]);

  // ─── SESSION TIMEOUT — auto-reset after inactivity ──────────────────────
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
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [screen, resetTimeout]);

  // ─── PREVENT CONTEXT MENU + TEXT SELECT + ZOOM on iPad ───────────────────
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);

    // Prevent pinch zoom (kiosk mode)
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchstart', preventZoom, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
      document.removeEventListener('touchstart', preventZoom);
    };
  }, []);

  const screens = {
    idle: <IdleScreen />,
    countdown: <CountdownScreen />,
    capture: <CountdownScreen />,
    preview: <PreviewScreen />,
    ai: <AIScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />,
  };

  return (
    <div
      className="booth-container"
      onTouchStart={resetTimeout}
      onClick={resetTimeout}
    >
      <FlashOverlay />
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
