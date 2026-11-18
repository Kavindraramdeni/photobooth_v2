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
import { LeadCaptureScreen } from './LeadCaptureScreen';
import { FlashOverlay } from './FlashOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, ShieldCheck, X } from 'lucide-react';

export function BoothMain() {
  const { screen, event, resetSession, setScreen } = useBoothStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  const branding = event?.branding;
  const rawBgMode = (branding as any)?.backgroundMode;
  const userMediaUrl = (branding?.wallpaperUrl as string) || (branding?.idleMediaUrl as string) || null;
  const isVideoMedia = Boolean(userMediaUrl?.match(/\.(mp4|webm|mov)(\?|$)/i));

  // Mutually exclusive background mode: 'light' | 'dark' | 'video' | 'image'
  // Clean, bright light studio theme is default for cohesive, smooth transitions
  let activeBgMode: 'light' | 'dark' | 'video' | 'image' = 'light';
  if (rawBgMode === 'light' || rawBgMode === 'dark' || rawBgMode === 'video' || rawBgMode === 'image') {
    activeBgMode = rawBgMode;
  } else if (branding?.themeMode === 'dark') {
    activeBgMode = 'dark';
  } else if (userMediaUrl) {
    activeBgMode = isVideoMedia ? 'video' : 'image';
  } else {
    activeBgMode = 'light';
  }

  const isLight = activeBgMode === 'light';
  const themeClass = isLight ? 'theme-light' : 'theme-dark';
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';

  // Video or Image rendered on Idle attract screen, and gently blurred on workflow screens for consistent Liquid Glass ambience
  const showVideo = activeBgMode === 'video';
  // If user uploaded a video, use it; otherwise automatically fallback to the official landing page video!
  const videoSrc = isVideoMedia && userMediaUrl ? userMediaUrl : '/video/snapbooth.mp4';
  const showImage = activeBgMode === 'image' && Boolean(userMediaUrl) && !isVideoMedia;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('[BoothMain] Video autoplay hindered by browser policy:', err);
      });
    }
  }, [showVideo, videoSrc, screen]);

  // Background sync for offline photo queue with live connection monitoring
  const triggerSync = useCallback(async () => {
    if (!event) return;
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(online);

    try {
      const pending = await getPendingCaptures(event.id);
      setPendingSyncCount(pending.length);

      if (pending.length > 0 && online) {
        setIsSyncing(true);
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
    } finally {
      setIsSyncing(false);
    }
  }, [event]);

  useEffect(() => {
    if (!event) return;

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    triggerSync();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(triggerSync, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [event, triggerSync]);

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

  const handleLeadComplete = () => {
    const gatingMode = (event?.settings as Record<string, unknown>)?.leadGatingMode || 'before_capture';
    if (gatingMode === 'before_capture') {
      setScreen('style');
    } else {
      setScreen('share');
    }
  };

  const screens: Record<string, React.ReactNode> = {
    idle: <IdleScreen />,
    lead: <LeadCaptureScreen onComplete={handleLeadComplete} onSkip={handleLeadComplete} />,
    style: <StyleScreen />,
    countdown: <CountdownScreen />,
    capture: <CountdownScreen />,
    preview: <PreviewScreen />,
    ai: <AIStudioScreen />,
    aistudio: <AIStudioScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />,
  };

  return (
    <div
      className={`booth-container relative ${themeClass} ${
        isLight
          ? 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 text-slate-900'
          : 'bg-gradient-to-br from-[#0c0d1b] via-[#090a14] to-[#140e28] text-white'
      }`}
      onTouchStart={resetTimeout}
      onClick={resetTimeout}
    >
      {/* Apple Liquid Glass Ambient Light Orbs */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full blur-[90px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-700/10 rounded-full blur-[110px]" />
      </div>

      {/* Background Media: Clear on Idle attract screen, Liquid Glass Frosted Blur on Workflow Screens */}
      {showVideo && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
              screen === 'idle' ? 'scale-100 opacity-100' : 'scale-105 opacity-40 blur-2xl'
            }`}
          />
          <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${
            screen === 'idle'
              ? 'bg-gradient-to-t from-black/60 via-black/15 to-black/35'
              : 'bg-black/60 backdrop-blur-3xl'
          }`} />
        </div>
      )}

      {showImage && userMediaUrl && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={userMediaUrl}
            alt="Event Background"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
              screen === 'idle' ? 'scale-100 opacity-100' : 'scale-105 opacity-40 blur-2xl'
            }`}
          />
          <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${
            screen === 'idle'
              ? 'bg-gradient-to-t from-black/60 via-black/15 to-black/35'
              : 'bg-black/60 backdrop-blur-3xl'
          }`} />
        </div>
      )}

      <FlashOverlay />

      {/* Screen Viewport with clean 250ms crossfade */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* ── Apple Liquid Glass Offline & Sync Status Pill (Only shown when offline or syncing, no floating online badge) ── */}
        {(!isOnline || isSyncing || pendingSyncCount > 0) && (
          <div className="absolute top-4 right-4 z-40 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSyncDetails((prev) => !prev);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-2xl transition-all duration-300 shadow-xl border ${
                !isOnline
                  ? 'bg-amber-950/80 border-amber-500/50 text-amber-200 shadow-amber-950/40 ring-1 ring-amber-500/30'
                  : 'bg-violet-950/80 border-violet-500/50 text-violet-200 shadow-violet-950/40'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    !isOnline ? 'bg-amber-400' : 'bg-violet-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isOnline ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                />
              </span>
              <span>
                {!isOnline
                  ? `📶 Offline • ${pendingSyncCount} saved locally`
                  : isSyncing
                  ? `🔄 Syncing ${pendingSyncCount} photos…`
                  : `⏳ ${pendingSyncCount} photos pending`}
              </span>
            </button>

            {/* Detailed Sync Popover on Tap */}
            <AnimatePresence>
              {showSyncDetails && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute top-10 right-0 w-72 p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl z-50 text-white space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs">Offline Sync Engine</span>
                    </div>
                    <button
                      onClick={() => setShowSyncDetails(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Venue Network:</span>
                      <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isOnline ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">IndexedDB Queue:</span>
                      <span className="font-semibold text-white font-mono">{pendingSyncCount} photos</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
                      Photos are always safely stored in browser local storage. When connection returns, they sync automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!isOnline || isSyncing}
                    onClick={() => triggerSync()}
                    className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing Now…' : 'Sync Queue Now'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
