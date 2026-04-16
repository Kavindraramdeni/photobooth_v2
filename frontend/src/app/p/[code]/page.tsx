'use client';

/**
 * /app/p/[code]/page.tsx
 * Short URL resolver — /p/a1b2c3 → fetches photo by short_code → renders gallery page
 *
 * This keeps QR codes short (yourapp.com/p/a1b2c3 instead of long UUID URLs),
 * which means smaller, faster-scanning QR codes.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Share2, Check, ArrowLeft } from 'lucide-react';

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

  const primaryColor = photo?.event?.branding?.primaryColor || '#7c3aed';
  const eventName = photo?.event?.branding?.eventName || photo?.event?.name || 'SnapBooth';
  const downloadUrl = photo?.download_url || photo?.url || '';
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Meaningful filename: EventName-YYYY-MM-DD.jpg
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
        // Try file share first (lets guest AirDrop / share actual image)
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `My photo from ${eventName}` });
          setShared(true);
          setTimeout(() => setShared(false), 2500);
          return;
        }
        // Fall back to URL share
        await navigator.share({ title: `My photo from ${eventName}`, url: pageUrl });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        return;
      } catch { /* cancelled */ }
    }
    // Last resort: copy link
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Loading your photo…</p>
      </div>
    </div>
  );

  if (error || !photo) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📷</div>
        <h1 className="text-white font-bold text-xl mb-2">Photo not found</h1>
        <p className="text-white/40 text-sm mb-6">{error || 'This link may have expired.'}</p>
        <a href="/gallery" className="inline-block px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm">
          ← Back to Gallery
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <a href="/gallery" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Gallery</span>
        </a>
        <div className="text-center">
          {photo.event?.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.event.branding.logoUrl} alt={eventName}
              className="h-7 w-auto object-contain mx-auto" />
          ) : (
            <p className="text-white font-bold text-sm">{eventName}</p>
          )}
        </div>
        <div className="w-16" />
      </div>

      {/* Photo */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">

          {/* Photo display */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-6 bg-black"
            style={{ boxShadow: `0 0 60px ${primaryColor}33` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Your photo"
              className="w-full object-contain"
              style={{ maxHeight: '65vh' }} />
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/70 font-medium">
              {photo.mode === 'gif' ? '🎬 GIF'
                : photo.mode === 'boomerang' ? '🔄 Boomerang'
                : photo.mode === 'strip' ? '🎞️ Strip'
                : photo.mode === 'ai' ? '🤖 AI Filter'
                : '📸 Photo'}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">

            {/* Save — primary CTA */}
            <button onClick={handleDownload} disabled={downloading}
              className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
              <Download className="w-5 h-5" />
              {downloading ? 'Saving…' : 'Save Photo'}
            </button>

            <p className="text-white/25 text-xs text-center">
              On iPhone: tap Save, then long-press → Save to Photos
            </p>

            {/* Share */}
            <button onClick={handleShare}
              className="w-full py-3.5 rounded-2xl font-semibold text-white/80 text-sm flex items-center justify-center gap-3 bg-white/8 border border-white/15 hover:bg-white/12 transition-all active:scale-95">
              {shared
                ? <><Check className="w-5 h-5 text-green-400" /><span className="text-green-400">Shared!</span></>
                : copied
                  ? <><Check className="w-5 h-5 text-green-400" /><span className="text-green-400">Link copied!</span></>
                  : <><Share2 className="w-5 h-5" /><span>Share this photo</span></>
              }
            </button>

            {/* WhatsApp */}
            <a href={`https://wa.me/?text=${encodeURIComponent(`📸 My photo from ${eventName}! ${pageUrl}`)}`}
              target="_blank" rel="noreferrer"
              className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-3 transition-all active:scale-95"
              style={{ background: '#25D366' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send via WhatsApp
            </a>
          </div>

          {/* Timestamp */}
          <p className="text-white/20 text-xs text-center mt-5">
            {new Date(photo.created_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-6 pt-2 text-center">
        <p className="text-white/15 text-xs">Powered by SnapBooth AI</p>
      </div>
    </div>
  );
}
