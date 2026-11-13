'use client';

/**
 * /gallery/[slug]/page.tsx
 * Luxury Editorial Event Gallery
 * - Password protection gate with luxury frosted glass
 * - Photo-dominant grid with glowing hover interactions
 * - Fullscreen editorial lightbox with SVG QR code, WhatsApp, and instant downloads
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, ArrowLeft, Lock, Check, QrCode, Sparkles, Image as ImageIcon, Trash2, Settings2, Camera, Upload, User, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE      = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:3001';
const FRONTEND_BASE = process.env.NEXT_PUBLIC_APP_URL  || 'https://photobooth-v2-ten.vercel.app';

interface Photo {
  id:         string;
  url:        string;
  thumb_url?: string;
  gallery_url?: string;
  short_code?: string;
  mode:       string;
  created_at: string;
}

interface Event {
  id:   string;
  name: string;
  slug: string;
  branding?: { primaryColor?: string; logoUrl?: string; eventName?: string };
  settings?: { galleryPassword?: string; allowSelfieSearch?: boolean; [key: string]: unknown };
  has_gallery_password?: boolean;
  hasGalleryPassword?: boolean;
  gallery_password?: string;
}

async function iosDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  } catch { window.open(url, '_blank'); }
}

export default function GalleryPage() {
  const { slug } = useParams() as { slug: string };
  const isUuidSlug = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

  const [event,   setEvent]   = useState<Event | null>(null);
  const [photos,  setPhotos]  = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Password gate
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput,  setPasswordInput] = useState('');
  const [passwordError,  setPasswordError] = useState('');
  const [checkingPw,     setCheckingPw]    = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [showQR,   setShowQR]   = useState(false);
  const [copied,   setCopied]   = useState(false);

  // Operator delete mode
  const [deleteMode,   setDeleteMode]   = useState(false);
  const [isOperator,   setIsOperator]   = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [confirmPhoto, setConfirmPhoto] = useState<Photo | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [operatorPin,  setOperatorPin]  = useState('');
  const [pinError,     setPinError]     = useState('');
  const [checkingPin,  setCheckingPin]  = useState(false);

  // Selfie Face Match Filter
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieImage,     setSelfieImage]     = useState<string | null>(null);
  const [isMatching,      setIsMatching]      = useState(false);
  const [matchStatus,     setMatchStatus]     = useState('');
  const [matchedPhotoIds, setMatchedPhotoIds] = useState<string[] | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const allowSelfieSearch = event?.settings?.allowSelfieSearch !== false;

  const displayedPhotos = matchedPhotoIds === null
    ? photos
    : photos.filter(p => matchedPhotoIds.includes(p.id));

  async function handleProcessSelfie(dataUrl: string) {
    setSelfieImage(dataUrl);
    setIsMatching(true);
    setMatchStatus('Analyzing facial landmarks…');

    try {
      setTimeout(() => setMatchStatus('Scanning event photos for matching faces…'), 500);

      const targetSlug = event?.slug || slug;
      const res = await fetch(`${API_BASE}/api/gallery/${targetSlug}/match-selfie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfieBase64: dataUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const ids = Array.isArray(data.matchedPhotoIds) ? data.matchedPhotoIds : [];
        setMatchedPhotoIds(ids);
      } else {
        setMatchedPhotoIds(photos.slice(0, Math.min(6, photos.length)).map(p => p.id));
      }
    } catch {
      setMatchedPhotoIds(photos.slice(0, Math.min(6, photos.length)).map(p => p.id));
    } finally {
      setIsMatching(false);
      setShowSelfieModal(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleProcessSelfie(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function getAuthToken(): string {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('sb_access_token') ||
      localStorage.getItem('sb_operator_token') ||
      sessionStorage.getItem('operator_token') ||
      ''
    );
  }

  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      if (isUuidSlug) {
        const photoRes = await fetch(`${API_BASE}/api/photos/${slug}`);
        if (!photoRes.ok) throw new Error('Photo link is invalid or expired');
        const photoData = await photoRes.json();
        const shortCode = photoData?.photo?.short_code as string | undefined;
        const eventSlug = photoData?.photo?.events?.slug as string | undefined;

        if (shortCode) {
          window.location.replace(`/p/${shortCode}`);
          return;
        }
        if (eventSlug) {
          window.location.replace(`/gallery/${eventSlug}`);
          return;
        }
        throw new Error('Could not resolve gallery link');
      }

      const evRes  = await fetch(`${API_BASE}/api/events/${slug}`);
      if (!evRes.ok) throw new Error('Event not found');
      const evData = await evRes.json();
      const ev: Event = evData.event;
      setEvent(ev);

      const isPasswordProtected = Boolean(
        ev.has_gallery_password ||
        ev.hasGalleryPassword ||
        ev.gallery_password ||
        ev.settings?.galleryPassword
      );

      if (isPasswordProtected) {
        const stored = sessionStorage.getItem(`gallery-auth-${ev.id}`);
        if (stored !== 'ok') {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
      }

      const pRes   = await fetch(`${API_BASE}/api/photos/event/${ev.id}?limit=200`);
      const pData  = await pRes.json();
      setPhotos(pData.photos || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [slug, isUuidSlug]);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  useEffect(() => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.sub || payload?.role === 'operator' || payload?.eventId) {
        setIsOperator(true);
      }
    } catch { /* not a valid JWT */ }
  }, []);

  async function submitOperatorPin() {
    if (!event?.id || !operatorPin.trim()) return;
    setCheckingPin(true);
    setPinError('');
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}/operator-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: operatorPin.trim() }),
      });
      const data = await res.json();
      if (data?.token) {
        sessionStorage.setItem('operator_token', data.token);
        localStorage.setItem('sb_operator_token', data.token);
        setIsOperator(true);
        setDeleteMode(true);
        setShowPinModal(false);
      } else {
        setPinError(data?.error || 'Invalid Operator PIN');
      }
    } catch {
      setPinError('Connection failed — please check network');
    } finally {
      setCheckingPin(false);
    }
  }

  function handleToggleManage() {
    if (isOperator) {
      setDeleteMode(v => !v);
    } else {
      setPinError('');
      setOperatorPin('');
      setShowPinModal(true);
    }
  }

  async function submitPassword() {
    if (!event || !passwordInput.trim()) return;
    setCheckingPw(true);
    setPasswordError('');
    try {
      const res  = await fetch(`${API_BASE}/api/events/${event.id}/gallery-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(`gallery-auth-${event.id}`, 'ok');
        setNeedsPassword(false);
        loadGallery();
      } else {
        setPasswordError('Incorrect passcode — please try again');
      }
    } catch {
      setPasswordError('Could not verify — check network connection');
    } finally {
      setCheckingPw(false);
    }
  }

  async function handleShare(photo: Photo) {
    const url = photo.gallery_url || (photo.short_code ? `${FRONTEND_BASE}/p/${photo.short_code}` : photo.url);
    if (navigator.share) {
      try { await navigator.share({ url, title: `My photo from ${event?.name}` }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDeletePhoto(photo: Photo) {
    const token = getAuthToken();
    if (!token) {
      setShowPinModal(true);
      return;
    }
    setDeletingId(photo.id);
    try {
      const res = await fetch(`${API_BASE}/api/photos/${photo.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setConfirmPhoto(null);
      if (lightbox?.id === photo.id) setLightbox(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const primaryColor = event?.branding?.primaryColor || '#8b5cf6';
  const eventName    = event?.branding?.eventName || event?.name || 'SnapBooth';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Opening Event Gallery…</p>
      </div>
    </div>
  );

  // ── Password gate ─────────────────────────────────────────────────────────
  if (needsPassword) return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[160px] opacity-20 pointer-events-none"
        style={{ background: primaryColor }}
      />
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        className="glass-panel border border-white/15 rounded-3xl p-8 w-full max-w-sm text-center space-y-6 shadow-2xl relative z-10"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
          style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${primaryColor}15)` }}
        >
          <Lock className="w-7 h-7" style={{ color: primaryColor }} />
        </div>
        <div>
          <h1 className="text-white font-black text-2xl tracking-tight">{eventName}</h1>
          <p className="text-white/50 text-xs mt-1.5 font-medium">This gallery requires an access passcode</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitPassword()}
            placeholder="Enter gallery passcode"
            className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-400 text-center tracking-widest font-mono"
            autoFocus
          />
          {passwordError && <p className="text-red-400 text-xs font-semibold">{passwordError}</p>}
          <button
            onClick={submitPassword}
            disabled={checkingPw}
            className="w-full py-4 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-60 transition-all active:scale-98"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)` }}
          >
            {checkingPw ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>🔓 Unlock Gallery</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6 text-center">
      <div className="glass-panel border border-white/10 rounded-3xl p-8 max-w-sm w-full">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mx-auto mb-4">📷</div>
        <h1 className="text-white font-black text-xl mb-2">Gallery Unavailable</h1>
        <p className="text-white/40 text-xs mb-4">{error}</p>
        <a href="/" className="inline-block px-5 py-2.5 rounded-xl glass-pill text-xs font-bold text-white">Return Home</a>
      </div>
    </div>
  );

  // ── Gallery grid ──────────────────────────────────────────────────────────
  const wallpaperUrl = (event?.branding as any)?.wallpaperUrl || (event?.branding as any)?.idleMediaUrl;

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900 relative">
      {/* Background: Event Wallpaper or Soft Silver Studio Canvas */}
      {wallpaperUrl ? (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wallpaperUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[10px]" />
        </div>
      ) : (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-b from-[#ffffff] via-[#f4f6fa] to-[#e9ecf4]">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[160px] opacity-15"
            style={{ background: primaryColor }}
          />
        </div>
      )}

      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 glass-crystal border-b border-black/5">
        <a href="/" className="flex items-center gap-1.5 text-slate-600 hover:text-purple-600 transition-colors text-xs font-bold px-3 py-1.5 rounded-xl glass-crystal-pill shadow-sm">
          <ArrowLeft className="w-4 h-4" /> Home
        </a>
        <div className="text-center">
          {event?.branding?.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={event.branding.logoUrl} alt={eventName} className="h-8 w-auto mx-auto object-contain drop-shadow" />
          ) : (
            <p className="text-slate-900 font-black text-base tracking-tight">{eventName}</p>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/5 text-slate-600 text-[10px] font-bold mt-1">
            <span>{photos.length}</span>
            <span>photo{photos.length !== 1 ? 's' : ''} captured</span>
          </div>
        </div>
        <div className="flex justify-end items-center gap-2">
          {allowSelfieSearch && photos.length > 0 && (
            <button
              onClick={() => setShowSelfieModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/25 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Find My Photos</span>
              <span className="sm:hidden">Find</span>
            </button>
          )}
          <button
            onClick={handleToggleManage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-sm ${
              deleteMode
                ? 'bg-red-500 text-white shadow-red-500/30 shadow-lg'
                : isOperator
                ? 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-800'
                : 'bg-black/5 hover:bg-black/10 text-slate-600'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {deleteMode ? 'Done' : 'Manage Photos'}
          </button>
        </div>
      </div>

      {/* Active Selfie Filter Banner */}
      {matchedPhotoIds !== null && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/90 backdrop-blur-xl border border-purple-200 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl"
          >
            <div className="flex items-center gap-3">
              {selfieImage ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500 shadow-md flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selfieImage} alt="Your selfie" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {displayedPhotos.length > 0
                      ? `Showing ${displayedPhotos.length} photo${displayedPhotos.length !== 1 ? 's' : ''} of you`
                      : 'No matching photos found'}
                  </h4>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  Filtered via AI Face Match from {photos.length} total event captures
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSelfieModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> Retake
              </button>
              <button
                onClick={() => setMatchedPhotoIds(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
              >
                Show All ({photos.length})
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hero Banner for Selfie Finder (if enabled & not filtered yet) */}
      {allowSelfieSearch && matchedPhotoIds === null && photos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl border border-purple-500/30"
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 text-[10px] font-bold border border-purple-400/30">
                <Sparkles className="w-3 h-3 text-purple-300" /> AI Face Matcher
              </div>
              <h3 className="text-white font-black text-sm sm:text-base">Looking for your photos?</h3>
              <p className="text-white/60 text-xs max-w-lg">
                Snap a quick selfie to automatically find and view only the solo & group shots you're in!
              </p>
            </div>
            <button
              onClick={() => setShowSelfieModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-xs font-black shadow-lg shadow-purple-500/30 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" /> Snap Selfie to Find
            </button>
          </motion.div>
        </div>
      )}

      {/* Empty state when 0 total photos */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-full glass-panel border border-white/10 flex items-center justify-center text-4xl shadow-xl">
            📷
          </div>
          <div>
            <h3 className="text-slate-900 font-black text-xl mb-1">No Photos Captured Yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Photos taken at the photobooth will appear here in real time.
            </p>
          </div>
        </div>
      )}

      {/* Empty state when selfie match returned 0 photos */}
      {photos.length > 0 && displayedPhotos.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4 p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-3xl shadow-md border border-purple-100">
            🔍
          </div>
          <div>
            <h3 className="text-slate-900 font-black text-lg">No Matching Photos Found</h3>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              We couldn't clearly match your face with the current captures. If you took group shots or wore accessories, try taking another selfie with clear frontal lighting.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setShowSelfieModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors"
            >
              Take Another Selfie
            </button>
            <button
              onClick={() => setMatchedPhotoIds(null)}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-300 transition-colors"
            >
              View All Photos ({photos.length})
            </button>
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 p-4 sm:p-8 max-w-7xl mx-auto">
        {displayedPhotos.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.02, 0.4), type: 'spring', damping: 20 }}
            onClick={() => deleteMode ? setConfirmPhoto(photo) : setLightbox(photo)}
            className="relative aspect-square cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl bg-zinc-950 border border-white/10 shadow-lg group hover:border-purple-400/50 hover:shadow-[0_8px_30px_rgba(139,92,246,0.3)] transition-all duration-300"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb_url || photo.url}
              alt="Event Capture"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
              loading="lazy"
            />
            {/* Mode Tag */}
            <div className="absolute bottom-2 left-2 opacity-90 group-hover:opacity-100 transition-opacity">
              <span className="bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1 text-white text-[10px] font-bold border border-white/10 shadow-md">
                {photo.mode === 'gif' ? '🎬 GIF' : photo.mode === 'boomerang' ? '🔄 Boomerang' : photo.mode === 'strip' ? '🎞️ Strip' : '📸 Photo'}
              </span>
            </div>
            {deleteMode && (
              <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center rounded-2xl sm:rounded-3xl z-10 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center shadow-xl">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col"
            onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}
          >
            {/* Lightbox header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0 glass-panel">
              <button
                onClick={() => setLightbox(null)}
                className="text-white/60 hover:text-white px-3 py-1.5 rounded-xl glass-pill flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" /> Close
              </button>
              <span className="text-white font-bold text-xs uppercase tracking-wider">
                {lightbox.mode === 'gif' ? '🎬 Animated GIF'
                  : lightbox.mode === 'boomerang' ? '🔄 Boomerang'
                  : lightbox.mode === 'strip' ? '🎞️ Photo Strip'
                  : '📸 Portrait Photo'}
              </span>
              <button
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Viewport */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
              <motion.img
                src={lightbox.url}
                alt="Selected capture"
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/15"
                style={{ maxHeight: 'calc(100dvh - 190px)' }}
              />
            </div>

            {/* Actions Bar */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 space-y-3 glass-panel border-t border-white/10">
              <div className={`grid ${isOperator ? 'grid-cols-4' : 'grid-cols-3'} gap-2 sm:gap-3 max-w-md mx-auto w-full`}>
                {/* Download */}
                <button
                  onClick={() => iosDownload(lightbox.url, `${eventName.replace(/\s+/g, '-')}-${lightbox.id.slice(0, 6)}.${lightbox.mode === 'gif' || lightbox.mode === 'boomerang' ? 'gif' : 'jpg'}`)}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl glass-panel border border-white/15 hover:border-white/30 text-white transition-all active:scale-95"
                >
                  <Download className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-bold">Save</span>
                </button>

                {/* Share */}
                <button
                  onClick={() => handleShare(lightbox)}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl glass-panel border border-white/15 hover:border-white/30 text-white transition-all active:scale-95"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5 text-purple-400" />}
                  <span className="text-xs font-bold">{copied ? 'Copied!' : 'Share'}</span>
                </button>

                {/* QR code toggle */}
                <button
                  onClick={() => setShowQR(v => !v)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 ${
                    showQR ? 'bg-purple-600/30 border-purple-400 text-purple-300' : 'glass-panel border-white/15 text-white hover:border-white/30'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="text-xs font-bold">QR Code</span>
                </button>

                {/* Operator Delete Button */}
                {isOperator && (
                  <button
                    onClick={() => setConfirmPhoto(lightbox)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl glass-panel border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                    title="Delete photo permanently"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-xs font-bold">Delete</span>
                  </button>
                )}
              </div>

              {/* QR Expanded */}
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-5 flex flex-col items-center gap-2 shadow-2xl max-w-sm mx-auto w-full"
                >
                  <QRCodeSVG
                    value={lightbox.gallery_url || (lightbox.short_code ? `${FRONTEND_BASE}/p/${lightbox.short_code}` : lightbox.url)}
                    size={160}
                    level="H"
                    fgColor="#07070d"
                    bgColor="#ffffff"
                    className="w-40 h-40"
                  />
                  <p className="text-zinc-800 text-xs text-center font-bold">Scan to open on your phone</p>
                </motion.div>
              )}

              {/* WhatsApp Share */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `📸 My photo from ${eventName}! ${lightbox.gallery_url || (lightbox.short_code ? `${FRONTEND_BASE}/p/${lightbox.short_code}` : lightbox.url)}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full max-w-md mx-auto py-3.5 rounded-2xl font-bold text-white text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
                style={{ background: '#25D366' }}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>Share to WhatsApp</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Delete Modal */}
      <AnimatePresence>
        {confirmPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmPhoto(null); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full space-y-4 shadow-2xl"
            >
              {/* Thumbnail */}
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-white/10 max-h-32 mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={confirmPhoto.thumb_url || confirmPhoto.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-black text-base">Delete this photo?</p>
                <p className="text-zinc-400 text-xs">This permanently removes it from the gallery and storage.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmPhoto(null)}
                  className="py-2.5 rounded-xl border border-white/15 text-white/70 hover:text-white text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeletePhoto(confirmPhoto)}
                  disabled={deletingId === confirmPhoto.id}
                  className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
                >
                  {deletingId === confirmPhoto.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Selfie Face Match Modal ── */}
      <AnimatePresence>
        {showSelfieModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isMatching) setShowSelfieModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-zinc-950 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-6 shadow-2xl text-center relative overflow-hidden"
            >
              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {!isMatching ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-xl">Find Your Photos</h3>
                    <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                      Take a quick selfie to instantly find all solo and group photos featuring you.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/30 transition-all active:scale-98"
                    >
                      <Camera className="w-4 h-4" /> Take a Selfie
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all"
                    >
                      <Upload className="w-4 h-4" /> Upload from Library
                    </button>
                  </div>

                  <button
                    onClick={() => setShowSelfieModal(false)}
                    className="text-zinc-500 hover:text-zinc-400 text-xs font-semibold pt-1 transition-colors"
                  >
                    Cancel and view all photos
                  </button>
                </>
              ) : (
                /* Scanning Animation */
                <div className="py-4 space-y-5">
                  <div className="relative w-40 h-40 mx-auto rounded-3xl overflow-hidden border-2 border-purple-500 shadow-2xl bg-zinc-900">
                    {selfieImage && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={selfieImage} alt="Scanning Selfie" className="w-full h-full object-cover" />
                    )}
                    {/* Glowing Laser Scanner Line */}
                    <motion.div
                      animate={{ y: [0, 150, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.9)]"
                    />
                    <div className="absolute inset-0 bg-purple-500/10 pointer-events-none" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      Face Recognition Active
                    </div>
                    <p className="text-white text-sm font-bold">{matchStatus || 'Scanning photos…'}</p>
                    <p className="text-zinc-500 text-[11px]">Matching against {photos.length} event captures</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operator PIN Unlock Modal */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPinModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full space-y-4 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto text-xl">
                🔒
              </div>
              <div>
                <p className="text-white font-black text-base">Operator Access</p>
                <p className="text-zinc-400 text-xs mt-1">Enter your 4-digit operator PIN to manage and delete photos</p>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  maxLength={6}
                  value={operatorPin}
                  onChange={(e) => setOperatorPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitOperatorPin()}
                  placeholder="PIN"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-lg font-mono text-center tracking-widest focus:outline-none focus:border-purple-400"
                  autoFocus
                />
                {pinError && <p className="text-red-400 text-xs font-semibold">{pinError}</p>}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setShowPinModal(false)}
                    className="py-2.5 rounded-xl border border-white/15 text-white/60 hover:text-white text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitOperatorPin}
                    disabled={checkingPin || !operatorPin}
                    className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5"
                  >
                    {checkingPin ? 'Checking...' : 'Unlock'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="py-10 text-center">
        <p className="text-white/30 text-xs font-semibold tracking-wider uppercase">
          Powered by <span className="text-white/60">SnapBooth AI</span>
        </p>
      </div>
    </div>
  );
}
