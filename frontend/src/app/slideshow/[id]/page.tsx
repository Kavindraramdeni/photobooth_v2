'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Play, Pause, Maximize, QrCode, Sparkles } from 'lucide-react';
import QRCode from 'qrcode.react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_BASE = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
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
  };
}

export default function SlideshowPage() {
  const params = useParams();
  const idOrSlug = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Event & Initial Photos
  useEffect(() => {
    if (!idOrSlug) return;

    async function loadData() {
      try {
        setLoading(true);
        // Fetch event details
        const evRes = await fetch(`${API_BASE}/api/events/${idOrSlug}`);
        if (!evRes.ok) throw new Error('Event not found');
        const evData = await evRes.json();
        const ev = evData.event;
        setEvent(ev);

        // Fetch visible photos
        const photoRes = await fetch(`${API_BASE}/api/photos/event/${ev.id}?limit=100`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          const visible = (photoData.photos || []).filter((p: Photo) => !p.is_hidden);
          setPhotos(visible);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load slideshow');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [idOrSlug]);

  // 2. Real-time updates via Socket.IO
  useEffect(() => {
    if (!event) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.emit('join-event', event.id);

    socket.on('photo-taken', (newPhoto: { photoId: string; thumbUrl: string; galleryUrl: string }) => {
      setPhotos((prev) => {
        // Prevent duplicate
        if (prev.some((p) => p.id === newPhoto.photoId)) return prev;
        const fresh: Photo = {
          id: newPhoto.photoId,
          url: newPhoto.galleryUrl || newPhoto.thumbUrl,
          thumb_url: newPhoto.thumbUrl,
        };
        // Insert new photo at start and immediately display
        return [fresh, ...prev];
      });
      setCurrentIndex(0); // Jump to newest photo
    });

    return () => {
      socket.disconnect();
    };
  }, [event]);

  // 3. Slideshow Rotation
  const nextSlide = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevSlide = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;
    timerRef.current = setInterval(nextSlide, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, nextSlide, photos.length]);

  // 4. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/60">Initializing Live Slideshow...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Slideshow Unavailable</h1>
          <p className="text-white/60">{error || 'Event not found'}</p>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const galleryUrl = `${APP_BASE}/gallery/${event.slug}`;
  const primaryColor = event.branding?.primaryColor || '#8B5CF6';

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center">
      {/* Background Ambient Blur */}
      {currentPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-110 transition-all duration-1000"
          style={{ backgroundImage: `url(${currentPhoto.url})` }}
        />
      )}

      {/* Main Photo Display */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 sm:p-12">
        <AnimatePresence mode="wait">
          {currentPhoto ? (
            <motion.div
              key={currentPhoto.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhoto.url}
                alt="Event memory"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </motion.div>
          ) : (
            <div className="text-center text-white/50">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
              <h2 className="text-3xl font-bold text-white mb-2">Welcome to {event.name}</h2>
              <p className="text-lg">Photos will appear here live as guests take them!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          {event.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.branding.logoUrl} alt={event.name} className="h-10 w-auto object-contain" />
          ) : (
            <h1 className="text-2xl font-black text-white tracking-wide">{event.name}</h1>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Live
          </span>
        </div>

        {/* Quick Screen Controls */}
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white/70">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="hover:text-white transition p-1"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowQR((q) => !q)}
            className="hover:text-white transition p-1"
            title="Toggle QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="hover:text-white transition p-1"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating QR Corner Overlay */}
      {showQR && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-4 p-4 rounded-2xl bg-black/70 backdrop-blur-lg border border-white/15 shadow-2xl text-white"
        >
          <div className="p-2 bg-white rounded-xl shadow">
            <QRCode value={galleryUrl} size={88} renderAs="svg" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Scan to View Gallery</p>
            <p className="text-sm font-bold">{event.name}</p>
            <p className="text-xs text-white/50 mt-0.5">Download your photos</p>
          </div>
        </motion.div>
      )}

      {/* Slide Counter Footer */}
      {photos.length > 0 && (
        <div className="absolute bottom-6 left-6 z-20 text-white/40 text-xs font-medium">
          {currentIndex + 1} / {photos.length} photos
        </div>
      )}
    </div>
  );
}
