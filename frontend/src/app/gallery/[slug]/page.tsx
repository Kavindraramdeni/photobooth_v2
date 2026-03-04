'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  mode: string;
  created_at: string;
  gallery_url: string;
}

interface Event {
  id: string;
  name: string;
  branding: { primaryColor?: string; footerText?: string };
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function GalleryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch(`${API}/api/events/${slug}`);
        const evData = await evRes.json();
        setEvent(evData.event);

        const phRes = await fetch(`${API}/api/photos/event/${evData.event.id}`);
        const phData = await phRes.json();
        setPhotos(phData.photos || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold mb-2">Gallery Not Found</h2>
          <p className="text-white/50">This event doesn't exist or has been archived.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5 text-center">
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: primaryColor }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black">{event.name}</h1>
        <p className="text-white/40 text-sm mt-1">{photos.length} photos</p>
      </div>

      {/* Photos grid */}
      <div className="max-w-6xl mx-auto p-6">
        {photos.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <div className="text-5xl mb-4">📷</div>
            <p>No photos yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelected(photo)}
                className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all group aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumb_url || photo.url}
                  alt="Photo"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2">
                  <span className="bg-black/60 text-white/70 text-xs px-2 py-0.5 rounded-full">
                    {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'ai' ? '🤖' : '📸'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.url}
              alt="Photo"
              className="w-full rounded-2xl"
            />
            <div className="flex gap-3 mt-4">
              <a
                href={selected.url}
                download
                className="flex-1 py-3 rounded-xl text-center font-semibold text-white transition-colors"
                style={{ background: primaryColor }}
              >
                ⬇️ Download
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`📸 Check out my photo!\n${selected.url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 rounded-xl bg-[#25D366] text-white text-center font-semibold"
              >
                💬 WhatsApp
              </a>
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-3 rounded-xl bg-white/10 text-white font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-white/20 text-sm border-t border-white/5 mt-8">
        Powered by SnapBooth AI ✨
      </div>
    </div>
  );
}
