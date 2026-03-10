'use client';

/**
 * /gallery/[slug]/page.tsx
 * Public event gallery with:
 * - Password protection (checks event.settings.galleryPassword)
 * - Full photo grid with lightbox
 * - QR code surfaced on each photo for easy re-sharing
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, ArrowLeft, Lock, Check, QrCode } from 'lucide-react';

const API_BASE      = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:3001';
const FRONTEND_BASE = process.env.NEXT_PUBLIC_APP_URL  || 'https://photobooth-v2-xi.vercel.app';

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

// ─────────────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const { slug } = useParams() as { slug: string };

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
      // Get event by slug
      const evRes  = await fetch(`${API_BASE}/api/events/${slug}`);
      if (!evRes.ok) throw new Error('Event not found');
      const evData = await evRes.json();
      const ev: Event = evData.event;
      setEvent(ev);

      // Check if password protected
      if (ev.settings?.galleryPassword) {
        const stored = sessionStorage.getItem(`gallery-auth-${ev.id}`);
        if (stored !== 'ok') {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
      }

      // Load photos
      const pRes   = await fetch(`${API_BASE}/api/photos/event/${ev.id}?limit=200`);
      const pData  = await pRes.json();
      setPhotos(pData.photos || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
        setPasswordError('Incorrect password — try again');
      }
    } catch {
      setPasswordError('Could not verify — check connection');
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

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName    = event?.branding?.eventName || event?.name || 'SnapBooth';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Password gate ─────────────────────────────────────────────────────────
  if (needsPassword) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-[#141420] rounded-3xl p-8 w-full max-w-sm border border-white/10 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${primaryColor}30` }}>
          <Lock className="w-7 h-7" style={{ color: primaryColor }} />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl">{eventName}</h1>
          <p className="text-white/40 text-sm mt-1">This gallery is password protected</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitPassword()}
            placeholder="Enter gallery password"
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500 text-center"
            autoFocus
          />
          {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
          <button onClick={submitPassword} disabled={checkingPw}
            className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
            {checkingPw ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>🔓 View Gallery</>}
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-center">
      <div><div className="text-5xl mb-4">📷</div>
        <h1 className="text-white font-bold text-xl mb-2">Gallery not found</h1>
        <p className="text-white/40 text-sm">{error}</p></div>
    </div>
  );

  // ── Gallery grid ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f]">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#0d0d18]/95 backdrop-blur border-b border-white/10">
        <a href="/" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div className="text-center">
          {event?.branding?.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={event.branding.logoUrl} alt={eventName} className="h-7 w-auto mx-auto object-contain" />
            : <p className="text-white font-bold text-sm">{eventName}</p>
          }
          <p className="text-white/30 text-xs">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="text-5xl">📷</div>
          <p className="text-white/50 text-base font-semibold">No photos yet</p>
          <p className="text-white/30 text-sm">Be the first to step in front of the booth!</p>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 p-1">
        {photos.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.03, 0.5) }}
            onClick={() => setLightbox(photo)}
            className="relative aspect-square cursor-pointer overflow-hidden bg-black group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb_url || photo.url}
              alt="Photo"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {/* Mode badge */}
            <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-black/70 rounded-full px-2 py-0.5 text-white text-xs">
                {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : '📸'}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
            onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}
          >
            {/* Lightbox header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <button onClick={() => setLightbox(null)} className="text-white/50 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-white/50 text-sm">
                {lightbox.mode === 'gif' ? '🎬 GIF'
                  : lightbox.mode === 'boomerang' ? '🔄 Boomerang'
                  : lightbox.mode === 'strip' ? '🎞️ Strip'
                  : '📸 Photo'}
              </span>
              <button onClick={() => setLightbox(null)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              <motion.img
                src={lightbox.url} alt="Photo"
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="max-w-full max-h-full object-contain rounded-2xl"
                style={{ maxHeight: 'calc(100dvh - 200px)' }}
              />
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 px-4 pb-6 pt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Download */}
                <button
                  onClick={() => iosDownload(lightbox.url, `${eventName.replace(/\s+/g, '-')}-${lightbox.id.slice(0, 6)}.${lightbox.mode === 'gif' || lightbox.mode === 'boomerang' ? 'gif' : 'jpg'}`)}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white hover:bg-white/12 transition-colors">
                  <Download className="w-5 h-5" />
                  <span className="text-xs">Save</span>
                </button>

                {/* Share / Copy */}
                <button onClick={() => handleShare(lightbox)}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white hover:bg-white/12 transition-colors">
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Share2 className="w-5 h-5" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Share'}</span>
                </button>

                {/* QR */}
                <button onClick={() => setShowQR(v => !v)}
                  className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-colors ${showQR ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/8 border-white/15 text-white hover:bg-white/12'}`}>
                  <QrCode className="w-5 h-5" />
                  <span className="text-xs">QR Code</span>
                </button>
              </div>

              {/* QR code expanded — shows the short URL QR for re-scanning */}
              {showQR && (lightbox.gallery_url || lightbox.short_code) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2">
                  {/* Use a QR code service to render; the actual QR is stored on the backend */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                      lightbox.gallery_url || `${FRONTEND_BASE}/p/${lightbox.short_code}`
                    )}&size=160x160&margin=6`}
                    alt="QR code"
                    className="w-40 h-40 rounded-lg"
                  />
                  <p className="text-gray-500 text-xs text-center">Scan to view &amp; download this photo</p>
                  <p className="text-gray-400 text-xs font-mono text-center break-all">
                    {lightbox.short_code ? `${FRONTEND_BASE}/p/${lightbox.short_code}` : lightbox.gallery_url}
                  </p>
                </motion.div>
              )}

              {/* WhatsApp */}
              <a href={`https://wa.me/?text=${encodeURIComponent(
                  `📸 My photo from ${eventName}! ${lightbox.gallery_url || (lightbox.short_code ? `${FRONTEND_BASE}/p/${lightbox.short_code}` : lightbox.url)}`
                )}`}
                target="_blank" rel="noreferrer"
                className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-3"
                style={{ background: '#25D366' }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share via WhatsApp
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="py-8 text-center">
        <p className="text-white/15 text-xs">Powered by SnapBooth AI</p>
      </div>
    </div>
  );
}
