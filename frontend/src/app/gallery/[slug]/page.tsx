'use client';

/**
 * /gallery/[slug]/page.tsx
 *
 * When scanned from QR: /gallery/event-slug?photo=photo-uuid
 *   → fetches that single photo immediately
 *   → shows it fullscreen so guest can download/share
 *
 * Without ?photo param: shows full event gallery grid
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Download, Share2, ArrowLeft, X } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  mode: string;
  created_at: string;
}

interface Event {
  id: string;
  name: string;
  slug: string;
  branding?: { primaryColor?: string; eventName?: string; logoUrl?: string };
}

// ── Safe download (works on iOS) ──────────────────────────────────────────────
async function downloadPhoto(url: string, name: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  } catch {
    window.open(url, '_blank');
  }
}

// ── Single photo view — shown when QR code is scanned ────────────────────────
function SinglePhotoView({ photoId, eventSlug }: { photoId: string; eventSlug: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Fetch the specific photo directly
        const [photoRes, eventRes] = await Promise.all([
          fetch(`${API}/api/gallery/photo/${photoId}`),
          fetch(`${API}/api/events/${eventSlug}`),
        ]);

        if (!photoRes.ok) throw new Error('Photo not found');
        const photoData = await photoRes.json();
        setPhoto(photoData.photo);

        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData.event);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load photo');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [photoId, eventSlug]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      <p className="text-white/50 text-sm">Loading your photo...</p>
    </div>
  );

  if (error || !photo) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl mb-2">📷</div>
      <h1 className="text-white font-bold text-xl">Photo not found</h1>
      <p className="text-white/40 text-sm">This photo may have expired or been removed.</p>
      <a href={`/gallery/${eventSlug}`}
        className="mt-4 px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm">
        View All Photos
      </a>
    </div>
  );

  const eventName = event?.branding?.eventName || event?.name || 'SnapBooth';
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const ext = photo.mode === 'gif' || photo.mode === 'boomerang' ? 'gif' : 'jpg';
  const filename = `${eventName.replace(/\s+/g, '-')}-${photo.id.slice(0, 6)}.${ext}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <a href={`/gallery/${eventSlug}`} className="text-white/40 hover:text-white flex items-center gap-1.5 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Photos
        </a>
        <div className="text-center">
          {event?.branding?.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={event.branding.logoUrl} alt={eventName} className="h-7 w-auto object-contain" />
            : <p className="text-white font-bold text-sm">{eventName}</p>
          }
        </div>
        <div className="w-16" />
      </div>

      {/* Photo */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {photo.mode === 'gif' || photo.mode === 'boomerang'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo.url} alt="Your photo" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={photo.url} alt="Your photo" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
        }
      </div>

      {/* Mode badge */}
      {photo.mode !== 'single' && (
        <div className="flex justify-center py-2">
          <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/60">
            {photo.mode === 'gif' ? '🎬 Animated GIF'
              : photo.mode === 'boomerang' ? '🔄 Boomerang'
              : photo.mode === 'strip' ? '🎞️ Photo Strip'
              : photo.mode === 'aistudio' ? '✨ AI Art'
              : photo.mode}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 px-5 pb-10 pt-4 space-y-3">
        {/* Download */}
        <button
          onClick={() => downloadPhoto(photo.url, filename)}
          className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
          <Download className="w-5 h-5" />
          Save Photo
        </button>

        {/* Share */}
        <button
          onClick={async () => {
            const shareUrl = window.location.href;
            if (navigator.share) {
              try {
                await navigator.share({ title: `My photo from ${eventName}`, url: shareUrl });
                setShared(true);
              } catch { /* cancelled */ }
            } else {
              await navigator.clipboard.writeText(shareUrl);
              setShared(true);
              setTimeout(() => setShared(false), 2000);
            }
          }}
          className="w-full py-3.5 rounded-2xl font-semibold text-white/70 text-sm flex items-center justify-center gap-2 bg-white/[0.06] border border-white/[0.08]">
          <Share2 className="w-4 h-4" />
          {shared ? 'Link copied!' : 'Share Link'}
        </button>
      </div>
    </div>
  );
}

// ── Full gallery grid ─────────────────────────────────────────────────────────
function GalleryGrid({ slug }: { slug: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch(`${API}/api/events/${slug}`);
        if (!evRes.ok) throw new Error('Event not found');
        const evData = await evRes.json();
        const ev: Event = evData.event;
        setEvent(ev);

        const pRes = await fetch(`${API}/api/photos/event/${ev.id}?limit=200`);
        const pData = await pRes.json();
        setPhotos(pData.photos || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const eventName = event?.branding?.eventName || event?.name || 'SnapBooth';
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl">📷</div>
      <h1 className="text-white font-bold text-xl">Gallery not found</h1>
      <p className="text-white/40 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {event?.branding?.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={event.branding.logoUrl} alt={eventName} className="h-8 w-auto object-contain" />
            : <h1 className="text-white font-bold text-lg">{eventName}</h1>
          }
          <span className="text-white/30 text-sm">{photos.length} photos</span>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-4xl mx-auto px-3 py-4">
        {photos.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/30 text-lg">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setLightbox(photo)}
                className="relative aspect-square overflow-hidden rounded-xl bg-zinc-900 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumb_url || photo.url}
                  alt="photo"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {photo.mode !== 'single' && (
                  <div className="absolute top-1.5 left-1.5 text-xs bg-black/60 px-1.5 py-0.5 rounded-md text-white/80">
                    {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : '✨'}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-4">
            <a
              href={`/gallery/${slug}?photo=${lightbox.id}`}
              className="text-white/50 hover:text-white text-sm transition-colors">
              Open link
            </a>
            <button onClick={() => setLightbox(null)} className="text-white/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt="Photo" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
          <div className="flex-shrink-0 px-5 pb-10 pt-3 flex gap-3">
            <button
              onClick={() => downloadPhoto(
                lightbox.url,
                `${eventName.replace(/\s+/g, '-')}-${lightbox.id.slice(0, 6)}.${lightbox.mode === 'gif' || lightbox.mode === 'boomerang' ? 'gif' : 'jpg'}`
              )}
              className="flex-1 py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
              <Download className="w-4 h-4" /> Save
            </button>
            <button
              onClick={async () => {
                const url = `${window.location.origin}/gallery/${slug}?photo=${lightbox.id}`;
                if (navigator.share) {
                  await navigator.share({ title: `Photo from ${eventName}`, url }).catch(() => {});
                } else {
                  await navigator.clipboard.writeText(url);
                }
              }}
              className="flex-1 py-3.5 rounded-2xl font-semibold text-white/70 text-sm flex items-center justify-center gap-2 bg-white/[0.06] border border-white/[0.08]">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────────
export default function GalleryPage() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const photoId = searchParams?.get('photo');

  // If QR code scan (has photo param) → show single photo view
  if (photoId) {
    return <SinglePhotoView photoId={photoId} eventSlug={slug} />;
  }

  // Otherwise → show full gallery grid
  return <GalleryGrid slug={slug} />;
}
