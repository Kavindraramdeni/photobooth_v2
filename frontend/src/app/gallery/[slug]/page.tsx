'use client';

/**
 * /gallery/[slug]/page.tsx
 * Luxury Editorial Event Gallery
 * - Password protection gate with luxury frosted glass
 * - Photo-dominant grid with glowing hover interactions
 * - Fullscreen editorial lightbox with SVG QR code, WhatsApp, and instant downloads
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, ArrowLeft, Lock, Check, QrCode, Sparkles, Image as ImageIcon } from 'lucide-react';
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
  settings?: { galleryPassword?: string };
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
        <div className="w-16" />
      </div>

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-full glass-panel border border-white/10 flex items-center justify-center text-4xl shadow-xl">
            📷
          </div>
          <div>
            <h3 className="text-white font-black text-xl mb-1">No Photos Captured Yet</h3>
            <p className="text-white/40 text-sm max-w-sm">
              Photos taken at the photobooth will appear here in real time.
            </p>
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 p-4 sm:p-8 max-w-7xl mx-auto">
        {photos.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.02, 0.4), type: 'spring', damping: 20 }}
            onClick={() => setLightbox(photo)}
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
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto w-full">
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

      {/* Footer */}
      <div className="py-10 text-center">
        <p className="text-white/30 text-xs font-semibold tracking-wider uppercase">
          Powered by <span className="text-white/60">SnapBooth AI</span>
        </p>
      </div>
    </div>
  );
}
