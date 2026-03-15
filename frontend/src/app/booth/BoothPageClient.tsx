'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useBoothStore } from '@/lib/store';
import { getEvent } from '@/lib/api';
import { BoothMain } from '@/components/booth/BoothMain';
import { BoothGuard } from '@/components/booth/BoothGuard';
import { BoothErrorBoundary } from '@/components/booth/ErrorBoundary';
import { motion } from 'framer-motion';
import { Camera, Sparkles } from 'lucide-react';

// Demo context — lets PreviewScreen know to show the trial CTA
export const DemoContext = createContext(false);
export const useIsDemo = () => useContext(DemoContext);

const DEMO_EVENT_SLUG = process.env.NEXT_PUBLIC_DEMO_EVENT_SLUG || 'snapbooth-demo';

interface BoothPageClientProps {
  eventSlug?: string;
}

export function BoothPageClient({ eventSlug }: BoothPageClientProps) {
  const { event, setEvent } = useBoothStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isDemo = eventSlug === DEMO_EVENT_SLUG;

  useEffect(() => {
    async function loadEvent() {
      // No slug at all → redirect to the live demo event
      if (!eventSlug) {
        router.replace(`/booth?event=${DEMO_EVENT_SLUG}`);
        return;
      }
      try {
        const eventData = await getEvent(eventSlug);
        setEvent(eventData);
      } catch {
        setError('Event not found. Please check your event link.');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventSlug, setEvent, router]);

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
          <a href={`/booth?event=${DEMO_EVENT_SLUG}`}
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition">
            Try the Demo Instead →
          </a>
        </div>
      </div>
    );
  }

  // ── Kiosk mode — fullscreen lock ─────────────────────────────────────────
  // Requests fullscreen on mount. On iPad in "Add to Home Screen" mode this
  // runs standalone and the browser chrome is already hidden.
  // The beforeunload + visibilitychange handlers make it hard to accidentally leave.
  useEffect(() => {
    const kioskMode = event?.settings?.kioskMode as boolean | undefined;
    if (!kioskMode) return;

    // Request fullscreen
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();

    // Block accidental navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    // Re-request fullscreen if user exits it
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setTimeout(() => {
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        }, 500);
      }
    };

    // Hide address bar on scroll (mobile)
    window.scrollTo(0, 1);

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [event?.settings?.kioskMode]);

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
