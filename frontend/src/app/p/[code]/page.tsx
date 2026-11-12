'use client';

/**
 * /app/p/[code]/page.tsx
 * Luxury Editorial Guest Photo View
 * - Dynamic ambient color glow extracted from photo backdrop
 * - Tactile action bar (Save Photo, Native Share, WhatsApp, QR)
 * - Instagram-story aesthetic
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, Check, ArrowLeft, QrCode, Sparkles, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PhotoData {
  id: string;
  url: string;
  thumb_url?: string;
  download_url?: string;
  short_code?: string;
  mode: string;
  created_at: string;
  event?: {
    id?: string;
    slug?: string;
    name: string;
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      eventName?: string;
    };
  };
  events?: {
    id?: string;
    slug?: string;
    name: string;
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      eventName?: string;
    };
  };
}

async function iosCompatibleDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  } catch {
    window.open(url, '_blank');
  }
}

export default function ShortUrlPage() {
  const params = useParams();
  const code = params.code as string;

  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!code) { setError('Invalid link'); setLoading(false); return; }
    fetch(`${API_BASE}/api/photos/short/${code}`)
      .then(r => {
        if (!r.ok) throw new Error(`Photo not found (${r.status})`);
        return r.json();
      })
      .then(data => setPhoto(data.photo || data))
      .catch(e => setError(e.message || 'Photo not found'))
      .finally(() => setLoading(false));
  }, [code]);

  const ev = photo?.events || photo?.event;
  const event = ev;
  const primaryColor = ev?.branding?.primaryColor || '#8b5cf6';
  const eventName = ev?.branding?.eventName || ev?.name || 'SnapBooth';
  const logoUrl = ev?.branding?.logoUrl;
  const downloadUrl = photo?.download_url || photo?.url || '';
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  const date = photo ? new Date(photo.created_at).toISOString().split('T')[0] : '';
  const filename = `${eventName.replace(/\s+/g, '-')}-${date}.jpg`;

  async function handleDownload() {
    if (!photo) return;
    setDownloading(true);
    try { await iosCompatibleDownload(downloadUrl, filename); }
    finally { setTimeout(() => setDownloading(false), 1500); }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `My photo from ${eventName}` });
          setShared(true);
          setTimeout(() => setShared(false), 2500);
          return;
        }
        await navigator.share({ title: `My photo from ${eventName}`, url: pageUrl });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        return;
      } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/50 text-xs font-semibold tracking-wider uppercase">Loading Guest Photo…</p>
      </div>
    </div>
  );

  if (error || !photo) return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6">
      <div className="glass-panel border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-3xl mx-auto mb-4">
          📷
        </div>
        <h1 className="text-white font-black text-xl mb-2">Photo Expired or Unavailable</h1>
        <p className="text-white/40 text-xs mb-6 leading-relaxed">{error || 'This capture session link could not be resolved.'}</p>
        <a
          href={event?.slug ? `/gallery/${event.slug}` : (event?.id ? `/gallery/${event.id}` : '#')}
          className="inline-flex items-center justify-center w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/30"
        >
          ← Return to Event Gallery
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07070d] flex flex-col select-none relative overflow-x-hidden">
      {/* Ambient Backdrop Extracted Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-25"
          style={{ background: primaryColor }}
        />
        <div
          className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 bg-indigo-600"
        />
      </div>

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 glass-panel">
        <a
          href={event?.slug ? `/gallery/${event.slug}` : (event?.id ? `/gallery/${event.id}` : '#')}
          className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-xs font-bold px-3 py-1.5 rounded-xl glass-pill"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Gallery</span>
        </a>

        <div className="text-center">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt={eventName} className="h-8 w-auto object-contain mx-auto drop-shadow" />
          ) : (
            <p className="text-white font-black text-sm tracking-tight">{eventName}</p>
          )}
        </div>

        <div className="w-16" />
      </div>

      {/* Main Photo Showcase */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className="w-full max-w-md mx-auto"
        >
          {/* Framed Photo with Editorial Glow */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-6 bg-black border border-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Your photobooth portrait"
              className="w-full object-contain max-h-[62vh] sm:max-h-[68vh] rounded-3xl"
            />

            {/* Mode Tag */}
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-full px-3 py-1 text-xs text-white/90 font-bold border border-white/10 shadow-lg">
              {photo.mode === 'gif' ? '🎬 Animated GIF'
                : photo.mode === 'boomerang' ? '🔄 Boomerang'
                : photo.mode === 'strip' ? '🎞️ Photo Strip'
                : photo.mode === 'ai' ? '✨ AI Artwork'
                : '📸 High-Res Photo'}
            </div>
          </div>

          {/* Action Hub */}
          <div className="space-y-3">
            {/* Save Photo CTA */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3 transition-all shadow-xl cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)` }}
            >
              <Download className="w-5 h-5" />
              <span>{downloading ? 'Preparing Full Resolution…' : 'Save Full Resolution Photo'}</span>
            </motion.button>

            <p className="text-white/40 text-[11px] text-center font-medium">
              💡 iPhone tip: Tap Save, then long-press image to Save to Camera Roll
            </p>

            {/* Share CTA */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2.5 glass-panel border border-white/15 hover:border-white/30 transition-all cursor-pointer"
            >
              {shared ? (
                <>
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400">Photo Shared!</span>
                </>
              ) : copied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5 text-purple-400" />
                  <span>Share Photo Link</span>
                </>
              )}
            </motion.button>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`📸 My photo from ${eventName}! Check it out here: ${pageUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#25D366]/20 transition-all active:scale-98"
              style={{ background: '#25D366' }}
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Send via WhatsApp</span>
            </a>

            {/* Session QR Toggle */}
            <button
              onClick={() => setShowQR(v => !v)}
              className="w-full py-3 rounded-2xl font-bold text-white/70 text-xs flex items-center justify-center gap-2 glass-pill hover:bg-white/10 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-purple-400" />
              <span>{showQR ? 'Hide Session QR' : 'Show Friend Share QR'}</span>
            </button>

            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="bg-white rounded-3xl p-5 flex flex-col items-center justify-center gap-2 shadow-2xl"
                >
                  <QRCodeSVG
                    value={pageUrl || photo.url}
                    size={180}
                    level="H"
                    fgColor="#07070d"
                    bgColor="#ffffff"
                    className="w-[180px] h-[180px]"
                  />
                  <p className="text-zinc-800 text-xs text-center font-bold mt-1">
                    Have friends scan this code to open your photo
                  </p>
                  <p className="text-zinc-400 text-[10px] font-mono text-center">
                    {code ? `Passcode: ${code}` : ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Captured Timestamp */}
          <p className="text-white/30 text-xs text-center mt-6 font-medium">
            Captured {new Date(photo.created_at).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </motion.div>
      </div>

      <div className="relative z-10 flex-shrink-0 px-4 pb-6 pt-2 text-center">
        <p className="text-white/30 text-xs font-semibold tracking-wider uppercase">
          Powered by <span className="text-white/60">SnapBooth AI</span>
        </p>
      </div>
    </div>
  );
}
