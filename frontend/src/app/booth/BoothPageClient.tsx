'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useBoothStore } from '@/lib/store';
import { getEvent, getEventById } from '@/lib/api';
import { BoothMain } from '@/components/booth/BoothMain';
import { BoothGuard } from '@/components/booth/BoothGuard';
import { BoothErrorBoundary } from '@/components/booth/ErrorBoundary';
import { motion } from 'framer-motion';
import { Camera, Sparkles } from 'lucide-react';

export const DemoContext = createContext(false);
export const useIsDemo = () => useContext(DemoContext);

const DEMO_EVENT_SLUG = process.env.NEXT_PUBLIC_DEMO_EVENT_SLUG || 'snapbooth-demo';

interface BoothPageClientProps {
  eventSlug?: string;
}

export function BoothPageClient({ eventSlug }: BoothPageClientProps) {
  const { setEvent } = useBoothStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isDemo = eventSlug === DEMO_EVENT_SLUG;

  useEffect(() => {
    async function loadEvent() {
      const target = eventSlug || DEMO_EVENT_SLUG;
      try {
        const eventSummary = await getEvent(target);
        if (!eventSummary) throw new Error('Event not found');
        const eventData = await getEventById(eventSummary.id);
        if (!eventData) throw new Error('Event not found');
        setEvent(eventData);
        setError(null);
      } catch {
        if (target !== DEMO_EVENT_SLUG) {
          try {
            const demoSummary = await getEvent(DEMO_EVENT_SLUG);
            if (!demoSummary) throw new Error('Event not found');
            const demoEvent = await getEventById(demoSummary.id);
            if (!demoEvent) throw new Error('Event not found');
            setEvent(demoEvent);
            router.replace(`/booth?event=${DEMO_EVENT_SLUG}`);
            setError(null);
            return;
          } catch {
            setError('Event not found. Please check your event link.');
          }
        } else {
          setError('Event not found. Please check your event link.');
        }
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventSlug, setEvent, router]);

  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setTimeout(() => {
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        }, 600);
      }
    };

    window.scrollTo(0, 1);

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="booth-container items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-lg">Loading your photobooth...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="booth-container items-center justify-center p-8">
        <div className="text-center">
          <Camera className="w-20 h-20 text-purple-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Oops!</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <a href={`/booth?event=${DEMO_EVENT_SLUG}`} className="inline-block mt-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition">
            Try the Demo Instead →
          </a>
        </div>
      </div>
    );
  }

  return (
    <DemoContext.Provider value={isDemo}>
      <BoothErrorBoundary>
        <BoothGuard>
          <BoothMain />
        </BoothGuard>
      </BoothErrorBoundary>
    </DemoContext.Provider>
  );
}
