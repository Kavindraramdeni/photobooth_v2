'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Download, Share2, Check, ArrowLeft } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PhotoData {
  id: string;
  url: string;
  thumb_url?: string;
  download_url?: string;
  mode: string;
  created_at: string;
  event?: {
    name: string;
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      eventName?: string;
    };
  };
}

// ── iOS-safe download ─────────────────────────────────────────────────────
// On iOS Safari, <a download> doesn't work — it opens in a new tab.
// The correct approach: fetch the image as a blob, create an object URL,
// then open it. On iOS this still opens in Safari viewer but user can
// long-press → Save to Photos. On Android/desktop it downloads directly.
async function iosCompatibleDownload(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch {
    // Fallback: open directly in new tab so user can long-press save
    window.open(url, '_blank');
  }
}

export default function GalleryPhotoPage() {
  const params = useParams();
  const photoId = params.id as string;

  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!photoId) { setError('Invalid photo link'); setLoading(false); return; }
    fetch(`${API_BASE}/api/photos/${photoId}`)
      .then(r => {
        if (!r.ok) throw new Error(`Photo not found (${r.status})`);
        return r.json();
      })
      .then(data => setPhoto(data.photo || data))
      .catch(e => setError(e.message || 'Photo not found'))
      .finally(() => setLoading(false));
  }, [photoId]);

  const primaryColor = photo?.event?.branding?.primaryColor || '#7c3aed';
  const eventName = photo?.event?.branding?.eventName || photo?.event?.name || 'SnapBooth';
  const downloadUrl = photo?.download_url || photo?.url || '';
  const filename = `${eventName.replace(/\s+/g, '_')}_photo_${photoId?.slice(0, 8)}.jpg`;
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  async function handleDownload() {
    if (!photo) return;
    setDownloading(true);
    try {
      await iosCompatibleDownload(downloadUrl, filename);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My photo from ${eventName}`,
          text: `📸 Check out my photobooth moment from ${eventName}!`,
          url: pageUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        return;
      } catch { /* cancelled */ }
    }
    // Fallback: copy link
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Loading your photo…</p>
      </div>
    </div>
  );

  // ── 404 / Error — friendly full page ──────────────────────────────────────
  // This is what guests see when they scan a QR code for a photo that's been
  // deleted, moderated/hidden, or the link is just wrong. Needs to be warm
  // and helpful, not a blank Next.js error screen.
  if (error || !photo) {
    const isPermission = error?.includes('403') || error?.includes('hidden');
    const isGone      = error?.includes('404') || error?.includes('not found');

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 text-center">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, #7c3aed18 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-sm w-full">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="text-7xl mb-6 block"
          >
            {isPermission ? '🛡️' : isGone ? '🔗' : '📷'}
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-white font-black text-2xl mb-2">
              {isPermission
                ? 'Photo unavailable'
                : isGone
                  ? 'Photo not found'
                  : 'Link not recognised'}
            </h1>
            <p className="text-white/40 text-sm leading-relaxed mb-8">
              {isPermission
                ? 'This photo has been removed by the event organiser.'
                : isGone
                  ? "This photo may have been deleted, or the link has expired. Check that you've scanned the right QR code."
                  : "We couldn't find a photo at this link. Double-check the URL or try scanning the QR code again."}
            </p>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href="/"
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 transition-colors"
              >
                🏠 Go to homepage
              </a>
              <button
                onClick={() => window.history.back()}
                className="w-full py-3.5 rounded-2xl font-semibold text-white/50 text-sm border border-white/10 hover:border-white/25 transition-colors"
              >
                ← Go back
              </button>
            </div>

            <p className="text-white/20 text-xs mt-8">
              SnapBooth AI · {new Date().getFullYear()}
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  const isGIF = photo.mode === 'gif' || photo.mode === 'boomerang';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <a href="/" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Home</span>
        </a>
        <div className="text-center">
          {photo.event?.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.event.branding.logoUrl} alt={eventName} className="h-7 w-auto object-contain mx-auto" />
          ) : (
            <p className="text-white font-bold text-sm">{eventName}</p>
          )}
        </div>
        <div className="w-16" />
      </div>

      {/* ── Photo ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">

        {/* Photo card */}
        <div className="w-full max-w-lg">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl mb-6 bg-black"
            style={{ boxShadow: `0 0 60px ${primaryColor}33` }}
          >
            {isGIF ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Your photo"
                className="w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt="Your photo"
                className="w-full object-contain"
                style={{ maxHeight: '65vh' }}
              />
            )}

            {/* Mode badge */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/70 font-medium">
              {photo.mode === 'gif' ? '🎬 GIF'
                : photo.mode === 'boomerang' ? '🔄 Boomerang'
                : photo.mode === 'strip' ? '🎞️ Strip'
                : photo.mode === 'ai' ? '🤖 AI Filter'
                : '📸 Photo'}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="space-y-3">

            {/* Download — primary CTA */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}
            >
              <Download className="w-5 h-5" />
              {downloading ? 'Saving…' : 'Save Photo to Device'}
            </button>

            {/* iOS hint */}
            <p className="text-white/25 text-xs text-center">
              On iPhone: tap Save, then long-press the photo → Save to Photos
            </p>

            {/* Share */}
            <button
              onClick={handleShare}
              className="w-full py-3.5 rounded-2xl font-semibold text-white/80 text-sm flex items-center justify-center gap-3 bg-white/8 border border-white/15 hover:bg-white/12 transition-all active:scale-95"
            >
              {shared
                ? <><Check className="w-5 h-5 text-green-400" /><span className="text-green-400">Shared!</span></>
                : copied
                  ? <><Check className="w-5 h-5 text-green-400" /><span className="text-green-400">Link copied!</span></>
                  : <><Share2 className="w-5 h-5" /><span>Share this photo</span></>
              }
            </button>

            {/* WhatsApp direct */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`📸 My photo from ${eventName}! View & download: ${pageUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-3 transition-all active:scale-95"
              style={{ background: '#25D366' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send via WhatsApp
            </a>
          </div>

          {/* Timestamp */}
          <p className="text-white/20 text-xs text-center mt-5">
            Captured {new Date(photo.created_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-4 pb-6 pt-2 text-center">
        <p className="text-white/15 text-xs">Powered by SnapBooth AI</p>
      </div>
    </div>
  );
}
