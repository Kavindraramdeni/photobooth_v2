'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, Lock, Grid3X3, LayoutList, X, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  gallery_url?: string;
  mode: string;
  created_at: string;
}

interface EventData {
  id: string;
  name: string;
  branding?: { primaryColor?: string; logoUrl?: string; eventName?: string };
}

export default function EventGalleryPage() {
  const params = useParams();
  // slug can be event ID or slug
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string);

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [lightbox, setLightbox] = useState<number | null>(null); // photo index

  const fetchGallery = useCallback(async (pg: number, pwd?: string) => {
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = {};
      if (pwd) headers['x-gallery-password'] = pwd;

      const res = await fetch(
        `${API_BASE}/api/gallery/event/${slug}?page=${pg}&pageSize=24`,
        { headers }
      );
      const data = await res.json();

      if (res.status === 401 && data.passwordRequired) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Gallery not found');

      setEvent(data.event);
      setPhotos(prev => pg === 1 ? data.photos : [...prev, ...data.photos]);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      setPage(pg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchGallery(1); }, [fetchGallery]);

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = event?.branding?.eventName || event?.name || 'Gallery';

  // Lightbox navigation
  function nextPhoto() { if (lightbox !== null && lightbox < photos.length - 1) setLightbox(lightbox + 1); }
  function prevPhoto() { if (lightbox !== null && lightbox > 0) setLightbox(lightbox - 1); }

  // Password gate
  if (passwordRequired && !password) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
          <Lock className="w-10 h-10 text-purple-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-1">Gallery is private</h2>
          <p className="text-white/40 text-sm mb-6">Enter the gallery password to view photos</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setPassword(passwordInput)}
            placeholder="Gallery password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 mb-3"
          />
          <button
            onClick={() => { setPassword(passwordInput); fetchGallery(1, passwordInput); }}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all"
            style={{ background: primaryColor }}
          >
            View Gallery
          </button>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-center p-6">
      <div>
        <p className="text-5xl mb-4">📭</p>
        <h2 className="text-white font-bold text-xl mb-2">Gallery not found</h2>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {event?.branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.branding.logoUrl} alt={eventName} className="h-9 w-auto object-contain" />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: primaryColor }}>
                  <span className="text-lg">📷</span>
                </div>
                <div>
                  <h1 className="font-bold text-base">{eventName}</h1>
                  <p className="text-white/40 text-xs">{total} photos</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60">
              {layout === 'grid' ? <LayoutList className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Loading skeleton */}
        {loading && photos.length === 0 && (
          <div className={`grid ${layout === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1'} gap-3`}>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && photos.length === 0 && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">📷</p>
            <h2 className="text-white/60 font-semibold text-lg mb-2">No photos yet</h2>
            <p className="text-white/30 text-sm">Photos taken at the booth will appear here</p>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className={`grid ${layout === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
            {photos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:border-white/30 transition-all"
                style={{ aspectRatio: layout === 'grid' ? '1' : '3/2' }}
                onClick={() => setLightbox(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumb_url || photo.url}
                  alt="photo"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  <div className="bg-black/60 rounded-full p-2"><Download className="w-4 h-4 text-white" /></div>
                  <div className="bg-black/60 rounded-full p-2"><Share2 className="w-4 h-4 text-white" /></div>
                </div>
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white/70">
                  {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : photo.mode === 'ai' ? '🤖' : '📸'}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more */}
        {page < totalPages && !loading && (
          <div className="text-center mt-8">
            <button
              onClick={() => fetchGallery(page + 1, password || undefined)}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-80"
              style={{ background: primaryColor }}
            >
              Load more photos
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10" onClick={() => setLightbox(null)}>
              <X className="w-5 h-5 text-white" />
            </button>
            {lightbox > 0 && (
              <button className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 z-10" onClick={e => { e.stopPropagation(); prevPhoto(); }}>
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {lightbox < photos.length - 1 && (
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 z-10" onClick={e => { e.stopPropagation(); nextPhoto(); }}>
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            )}
            <motion.div
              key={lightbox}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[lightbox]?.url}
                alt="photo"
                className="w-full rounded-2xl shadow-2xl object-contain max-h-[75vh]"
              />
              <div className="mt-4 flex gap-3">
                <a
                  href={photos[lightbox]?.gallery_url || `/gallery/${photos[lightbox]?.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 rounded-xl text-white font-semibold text-sm text-center transition-all hover:opacity-80"
                  style={{ background: primaryColor }}
                  onClick={e => e.stopPropagation()}
                >
                  View & Download
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`📸 Check out my photo! ${typeof window !== 'undefined' ? window.location.origin : ''}/gallery/${photos[lightbox]?.id}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 rounded-xl text-white font-semibold text-sm text-center bg-[#25D366] hover:opacity-80 transition-all"
                  onClick={e => e.stopPropagation()}
                >
                  WhatsApp
                </a>
              </div>
              <p className="text-white/30 text-xs text-center mt-2">
                {lightbox + 1} / {photos.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
