'use client';

/**
 * /slideshow/[id]/page.tsx
 * SnapBooth Live Projection & Venue Stream Engine
 * - Real-time Socket.IO ingest: displays newly captured photos within 2 seconds
 * - Customizable Ken Burns pan & zoom animation with smooth alternating paths
 * - Customizable QR code overlay to live event gallery
 * - Operator moderation drawer: hide, delete, freeze, speed control, quad mosaic
 * - Projector-ready: auto-hiding HUD controls for clean, zero-clutter venue screens
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  Play, Pause, Maximize, Minimize, QrCode, Sparkles,
  Shield, EyeOff, Trash2, Settings, Shuffle, Clock,
  Grid, Check, X, Lock, Flame, RefreshCw, ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_BASE = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://photobooth-v2-ten.vercel.app');

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  gallery_url?: string;
  mode?: string;
  is_hidden?: boolean;
  created_at?: string;
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    eventName?: string;
    wallpaperUrl?: string;
  };
  settings?: Record<string, unknown>;
}

type QRPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'hidden';
type DisplayMode = 'spotlight' | 'mosaic';

// Ken Burns animation variants (alternates across slides)
const KEN_BURNS_PRESETS = [
  { scale: [1.0, 1.15], x: ['0%', '-2%'], y: ['0%', '-1.5%'] },
  { scale: [1.14, 1.02], x: ['-2%', '1.5%'], y: ['-1.5%', '1%'] },
  { scale: [1.10, 1.10], x: ['2%', '-2%'], y: ['0%', '0%'] },
  { scale: [1.02, 1.15], x: ['-1.5%', '1.5%'], y: ['1.5%', '-1%'] },
];

export default function SlideshowPage() {
  const params = useParams();
  const idOrSlug = params.id as string;

  // Event & Photo Data
  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Slideshow Config
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalSec, setIntervalSec] = useState(5);
  const [kenBurns, setKenBurns] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [qrPosition, setQrPosition] = useState<QRPosition>('bottom-right');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('spotlight');
  const [shuffle, setShuffle] = useState(false);

  // Realtime & HUD States
  const [newCaptureAlert, setNewCaptureAlert] = useState<Photo | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Operator Moderation Drawer
  const [showModerator, setShowModerator] = useState(false);
  const [isOperatorAuth, setIsOperatorAuth] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [checkingPin, setCheckingPin] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);

  function getAuthToken(): string {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('sb_access_token') ||
      localStorage.getItem('sb_operator_token') ||
      sessionStorage.getItem('operator_token') ||
      ''
    );
  }

  // ── Auto-hiding HUD for clean cinema projection ────────────────────────────
  const resetHudTimer = useCallback(() => {
    setHudVisible(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      // Do not auto-hide HUD if moderator drawer is open
      if (!showModerator) {
        setHudVisible(false);
      }
    }, 4000);
  }, [showModerator]);

  useEffect(() => {
    const handleActivity = () => resetHudTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    resetHudTimer();
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, [resetHudTimer]);

  // Check existing operator auth
  useEffect(() => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.sub || payload?.role === 'operator' || payload?.eventId) {
        setIsOperatorAuth(true);
      }
    } catch { /* ignore */ }
  }, []);

  // ── 1. Fetch Event & Visible Photos ─────────────────────────────────────────
  useEffect(() => {
    if (!idOrSlug) return;

    async function loadData() {
      try {
        setLoading(true);
        const evRes = await fetch(`${API_BASE}/api/events/${idOrSlug}`);
        if (!evRes.ok) throw new Error('Event not found');
        const evData = await evRes.json();
        const ev = evData.event;
        setEvent(ev);

        const photoRes = await fetch(`${API_BASE}/api/photos/event/${ev.id}?limit=200`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          const visible = (photoData.photos || []).filter((p: Photo) => !p.is_hidden);
          setPhotos(visible);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load slideshow');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [idOrSlug]);

  // ── 2. Real-time Sub-2-Second Socket.IO Connection ──────────────────────────
  useEffect(() => {
    if (!event) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-event', event.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // A. Live photo captured (< 2 seconds from photobooth session)
    socket.on('photo-taken', (newPhoto: { photoId: string; thumbUrl: string; galleryUrl: string; mode?: string }) => {
      setPhotos((prev) => {
        if (prev.some((p) => p.id === newPhoto.photoId)) return prev;
        const fresh: Photo = {
          id: newPhoto.photoId,
          url: newPhoto.galleryUrl || newPhoto.thumbUrl,
          thumb_url: newPhoto.thumbUrl,
          mode: newPhoto.mode,
          created_at: new Date().toISOString(),
        };

        // Flash spotlight alert for 4 seconds
        setNewCaptureAlert(fresh);
        setTimeout(() => setNewCaptureAlert(null), 4500);

        return [fresh, ...prev];
      });

      // Jump instantly to newest photo
      setCurrentIndex(0);
    });

    // B. Live moderation (photo hidden in real-time)
    socket.on('photo-moderated', ({ photoId, is_hidden }: { photoId: string; is_hidden: boolean }) => {
      if (is_hidden) {
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.id !== photoId);
          return filtered;
        });
        // Advance slide smoothly if current is hidden
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    });

    // C. Live deletion (photo deleted permanently)
    socket.on('photo-deleted', ({ photoId }: { photoId: string }) => {
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.id !== photoId);
        return filtered;
      });
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
    });

    return () => {
      socket.disconnect();
    };
  }, [event]);

  // ── 3. Slideshow Rotation Cycle ─────────────────────────────────────────────
  const nextSlide = useCallback(() => {
    if (photos.length <= 1) return;
    if (shuffle) {
      setCurrentIndex((prev) => {
        let rand = Math.floor(Math.random() * photos.length);
        if (rand === prev && photos.length > 1) rand = (prev + 1) % photos.length;
        return rand;
      });
    } else {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
  }, [photos.length, shuffle]);

  const prevSlide = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;
    timerRef.current = setInterval(nextSlide, intervalSec * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, intervalSec, nextSlide, photos.length]);

  // ── 4. Fullscreen & Keyboard Hotkeys ────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in PIN input
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        nextSlide();
      } else if (e.code === 'ArrowLeft') {
        prevSlide();
      } else if (e.code === 'KeyQ') {
        setShowQR((q) => !q);
      } else if (e.code === 'KeyF') {
        toggleFullscreen();
      } else if (e.code === 'KeyK') {
        setKenBurns((k) => !k);
      } else if (e.code === 'KeyM') {
        setShowModerator((m) => !m);
      } else if (e.code === 'KeyH') {
        // Quick Hide
        if (photos[currentIndex]) handleHidePhoto(photos[currentIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, currentIndex, photos]);

  // ── 5. Operator Moderation Actions ──────────────────────────────────────────
  async function submitPin() {
    if (!event?.id || !pinInput.trim()) return;
    setCheckingPin(true);
    setPinError('');
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}/operator-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (data?.token) {
        sessionStorage.setItem('operator_token', data.token);
        localStorage.setItem('sb_operator_token', data.token);
        setIsOperatorAuth(true);
      } else {
        setPinError(data?.error || 'Invalid operator PIN');
      }
    } catch {
      setPinError('Connection failed');
    } finally {
      setCheckingPin(false);
    }
  }

  async function handleHidePhoto(photoId: string) {
    const token = getAuthToken();
    if (!token) {
      setShowModerator(true);
      return;
    }
    setModeratingId(photoId);
    try {
      const res = await fetch(`${API_BASE}/api/photos/${photoId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_hidden: true, reason: 'slideshow_moderator' }),
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (photos.length > 1) nextSlide();
      }
    } catch { /* error handled silently */ }
    finally { setModeratingId(null); }
  }

  async function handleDeletePhoto(photoId: string) {
    const token = getAuthToken();
    if (!token) {
      setShowModerator(true);
      return;
    }
    if (!confirm('Permanently delete this photo from the event and cloud storage?')) return;
    setModeratingId(photoId);
    try {
      const res = await fetch(`${API_BASE}/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (photos.length > 1) nextSlide();
      }
    } catch { /* error */ }
    finally { setModeratingId(null); }
  }

  // ── Render States ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070d] flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_25px_rgba(168,85,247,0.5)]" />
        <h2 className="text-xl font-bold tracking-tight">Initializing Projection Stream…</h2>
        <p className="text-white/40 text-xs mt-1">Connecting to live event broadcast room</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6 text-white text-center">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-sm w-full backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-2xl mb-4">
            ⚠️
          </div>
          <h1 className="text-2xl font-black mb-2">Slideshow Unavailable</h1>
          <p className="text-white/50 text-xs mb-6">{error || 'Event could not be found'}</p>
          <a href="/" className="px-5 py-2.5 rounded-xl bg-white/10 text-xs font-bold hover:bg-white/15 transition-colors">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const galleryUrl = `${APP_BASE}/gallery/${event.slug}`;
  const activePreset = KEN_BURNS_PRESETS[currentIndex % KEN_BURNS_PRESETS.length];

  // Quad mosaic photos slice
  const mosaicPhotos = photos.slice(currentIndex, currentIndex + 4);

  return (
    <div
      className="relative w-screen h-screen bg-[#050508] overflow-hidden select-none flex items-center justify-center"
      style={{ cursor: hudVisible ? 'default' : 'none' }}
    >
      {/* ── Background Ambient Light (Projector Glow) ── */}
      {currentPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-[100px] opacity-35 scale-125 transition-all duration-1000 pointer-events-none"
          style={{ backgroundImage: `url(${currentPhoto.thumb_url || currentPhoto.url})` }}
        />
      )}

      {/* ── Spotlight / Hero Display Area ── */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-3 sm:p-8">
        {displayMode === 'spotlight' ? (
          <AnimatePresence mode="wait">
            {currentPhoto ? (
              <motion.div
                key={currentPhoto.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
                className="w-full h-full flex items-center justify-center overflow-hidden"
              >
                {kenBurns ? (
                  <motion.div
                    animate={activePreset}
                    transition={{
                      duration: intervalSec + 1,
                      ease: 'linear',
                    }}
                    className="w-full h-full flex items-center justify-center will-change-transform"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPhoto.url}
                      alt={event.name}
                      className="max-w-[92vw] max-h-[86vh] object-contain rounded-2xl sm:rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] border border-white/10"
                    />
                  </motion.div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={currentPhoto.url}
                    alt={event.name}
                    className="max-w-[92vw] max-h-[86vh] object-contain rounded-2xl sm:rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] border border-white/10"
                  />
                )}
              </motion.div>
            ) : (
              /* Empty state before any photos are taken */
              <div className="text-center text-white/50 max-w-md p-8">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                <h2 className="text-3xl font-black text-white mb-2">{event.name}</h2>
                <p className="text-base text-white/60 mb-6">Live Projection Ready</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Photos captured in the booth will appear here within 2 seconds
                </div>
              </div>
            )}
          </AnimatePresence>
        ) : (
          /* ── Mosaic Quad Mode (4 Photos on Screen) ── */
          <div className="grid grid-cols-2 gap-4 w-full max-w-6xl max-h-[86vh] p-2">
            {mosaicPhotos.map((p, idx) => (
              <motion.div
                key={p.id + idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Live Ingestion Banner (<2s Flash Reveal) ── */}
      <AnimatePresence>
        {newCaptureAlert && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="absolute top-20 z-40 flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-[0_0_40px_rgba(168,85,247,0.7)] border border-white/30"
          >
            <Flame className="w-5 h-5 text-amber-300 animate-bounce" />
            <span className="font-black text-sm tracking-wide uppercase">✨ Just Captured at the Booth!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Auto-Hiding Top Header Overlay ── */}
      <motion.div
        initial={false}
        animate={{ opacity: hudVisible ? 1 : 0, y: hudVisible ? 0 : -20 }}
        transition={{ duration: 0.3 }}
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-auto"
      >
        <div className="flex items-center gap-4">
          {event.branding?.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={event.branding.logoUrl} alt={event.name} className="h-10 w-auto object-contain drop-shadow" />
          ) : (
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow">{event.name}</h1>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Live Stream
          </span>
          {socketConnected && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              Synced
            </span>
          )}
        </div>

        {/* Quick Projection Controls */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/15 text-white/80 shadow-2xl">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>
          <button
            onClick={() => setKenBurns((k) => !k)}
            className={`p-1.5 rounded-full transition ${kenBurns ? 'text-purple-400 bg-purple-500/20' : 'hover:text-white'}`}
            title="Toggle Ken Burns Motion (K)"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowQR((q) => !q)}
            className={`p-1.5 rounded-full transition ${showQR ? 'text-cyan-400 bg-cyan-500/20' : 'hover:text-white'}`}
            title="Toggle QR Overlay (Q)"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModerator((m) => !m)}
            className={`p-1.5 rounded-full transition ${showModerator ? 'text-amber-400 bg-amber-500/20' : 'hover:text-white'}`}
            title="Operator Moderation & Settings (M)"
          >
            <Shield className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>

      {/* ── Branded QR Code Overlay ── */}
      {showQR && qrPosition !== 'hidden' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`absolute z-30 flex items-center gap-4 p-4 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/20 shadow-[0_15px_40px_rgba(0,0,0,0.8)] text-white ${
            qrPosition === 'bottom-right'
              ? 'bottom-6 right-6'
              : qrPosition === 'bottom-left'
              ? 'bottom-6 left-6'
              : 'top-24 right-6'
          }`}
        >
          <div className="p-2.5 bg-white rounded-2xl shadow-xl flex-shrink-0">
            <QRCodeSVG value={galleryUrl} size={92} level="M" fgColor="#050508" />
          </div>
          <div className="pr-2 space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Event Gallery
            </span>
            <p className="text-sm font-black tracking-tight">{event.name}</p>
            <p className="text-[11px] text-white/50">Scan to download your memories</p>
          </div>
        </motion.div>
      )}

      {/* ── Auto-Hiding Bottom Counter ── */}
      {photos.length > 0 && (
        <motion.div
          initial={false}
          animate={{ opacity: hudVisible ? 1 : 0 }}
          className="absolute bottom-6 left-6 z-20 flex items-center gap-3 text-white/50 text-xs font-bold bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10"
        >
          <span>{currentIndex + 1} / {photos.length} captures</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span>{intervalSec}s loop</span>
          {kenBurns && <span className="text-purple-400 font-semibold">• Ken Burns</span>}
        </motion.div>
      )}

      {/* ── Operator Moderation Drawer ── */}
      <AnimatePresence>
        {showModerator && (
          <motion.div
            initial={{ opacity: 0, x: 380 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 380 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-zinc-950/95 backdrop-blur-2xl border-l border-white/15 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto text-white"
          >
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <h3 className="font-black text-base">Projection Controls</h3>
                </div>
                <button
                  onClick={() => setShowModerator(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!isOperatorAuth ? (
                /* PIN Unlock for Operator Access */
                <div className="py-8 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto text-xl">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Operator PIN Required</h4>
                    <p className="text-white/40 text-xs mt-1">Enter your event operator PIN to moderate live photos</p>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                    placeholder="PIN"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:border-purple-400"
                    autoFocus
                  />
                  {pinError && <p className="text-red-400 text-xs font-semibold">{pinError}</p>}
                  <button
                    onClick={submitPin}
                    disabled={checkingPin || !pinInput}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {checkingPin ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Unlock Moderation'}
                  </button>
                </div>
              ) : (
                /* Authenticated Moderation Controls */
                <div className="py-6 space-y-6">
                  {/* Current Photo Quick Moderation */}
                  {currentPhoto && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentPhoto.thumb_url || currentPhoto.url}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">Current Slide</p>
                          <p className="text-[10px] text-white/40 truncate">ID: {currentPhoto.id}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleHidePhoto(currentPhoto.id)}
                          disabled={moderatingId === currentPhoto.id}
                          className="py-2.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Hide from Screen
                        </button>
                        <button
                          onClick={() => handleDeletePhoto(currentPhoto.id)}
                          disabled={moderatingId === currentPhoto.id}
                          className="py-2.5 px-3 rounded-xl bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transition Speed */}
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Slide Duration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 5, 8, 12].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setIntervalSec(sec)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                            intervalSec === sec
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ken Burns Motion */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-xs font-bold">Ken Burns Animation</p>
                      <p className="text-[10px] text-white/40">Smooth cinematic pan & zoom</p>
                    </div>
                    <button
                      onClick={() => setKenBurns(!kenBurns)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${kenBurns ? 'bg-purple-600' : 'bg-white/15'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          kenBurns ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Display Mode (Spotlight vs Mosaic) */}
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5" /> Projection Layout
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDisplayMode('spotlight')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                          displayMode === 'spotlight'
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                      >
                        Cinematic Spotlight
                      </button>
                      <button
                        onClick={() => setDisplayMode('mosaic')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                          displayMode === 'mosaic'
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                      >
                        Quad Mosaic (4-Up)
                      </button>
                    </div>
                  </div>

                  {/* QR Position */}
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" /> QR Overlay Location
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: 'bottom-right', label: 'Bottom Right' },
                        { key: 'bottom-left', label: 'Bottom Left' },
                        { key: 'top-right', label: 'Top Right' },
                        { key: 'hidden', label: 'Hidden' },
                      ].map((pos) => (
                        <button
                          key={pos.key}
                          onClick={() => {
                            setQrPosition(pos.key as QRPosition);
                            setShowQR(pos.key !== 'hidden');
                          }}
                          className={`py-2 px-3 rounded-xl font-semibold border transition-all ${
                            qrPosition === pos.key
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                              : 'bg-white/5 border-white/10 text-white/50'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shuffle Order */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-xs font-bold">Random Shuffle</p>
                      <p className="text-[10px] text-white/40">Randomize rotation order</p>
                    </div>
                    <button
                      onClick={() => setShuffle(!shuffle)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${shuffle ? 'bg-purple-600' : 'bg-white/15'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          shuffle ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Reference */}
            <div className="pt-4 border-t border-white/10 space-y-1.5 text-[11px] text-white/40">
              <p className="font-bold uppercase tracking-wider text-white/60">Keyboard Hotkeys</p>
              <div className="grid grid-cols-2 gap-1 font-mono">
                <span>[Space] Pause/Play</span>
                <span>[F] Fullscreen</span>
                <span>[→] Next Slide</span>
                <span>[←] Previous</span>
                <span>[K] Ken Burns</span>
                <span>[Q] Toggle QR</span>
                <span>[M] Controls</span>
                <span>[H] Hide Photo</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
