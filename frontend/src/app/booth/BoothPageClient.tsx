'use client';

import { kioskController } from '@/components/booth/KioskController';
import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useBoothStore } from '@/lib/store';
import { getEvent, setBoothToken } from '@/lib/api';
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
        if (eventData?.boothToken && eventData?.id) {
          setBoothToken(eventData.boothToken, eventData.id);
        }
      } catch {
        setError('Event not found. Please check your event link.');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventSlug, setEvent, router]);

  // ── Live synchronization from Admin changes ──────────────────────────────
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('snapbooth_event_bus');
      bc.onmessage = (msg) => {
        if (msg.data?.type === 'EVENT_UPDATED' && msg.data?.event) {
          const updated = msg.data.event;
          if (updated.slug === eventSlug || (event && updated.id === event.id)) {
            setEvent(updated);
          }
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key && event?.id && e.key === `snapbooth_live_event_${event.id}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setEvent({
            ...event,
            branding: parsed.branding,
            settings: parsed.settings,
            name: parsed.name || event.name,
          });
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Periodic background poll so remote kiosks also pick up design changes
    const pollInterval = setInterval(async () => {
      if (!eventSlug || document.visibilityState !== 'visible') return;
      try {
        const fresh = await getEvent(eventSlug);
        if (fresh && JSON.stringify(fresh.branding) !== JSON.stringify(event?.branding)) {
          setEvent(fresh);
        }
      } catch {}
    }, 12000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [eventSlug, event, setEvent]);

    // ── Fullscreen only from explicit user gesture (browser compliant) ─────────
  useEffect(() => {
    const el = document.documentElement;

    const requestFullscreen = () => {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    };

    const activateFullscreen = () => {
      requestFullscreen();
      window.removeEventListener('pointerdown', activateFullscreen);
      window.removeEventListener('keydown', activateFullscreen);
      window.removeEventListener('touchstart', activateFullscreen);
    };

    window.addEventListener('pointerdown', activateFullscreen, { once: true });
    window.addEventListener('keydown', activateFullscreen, { once: true });
    window.addEventListener('touchstart', activateFullscreen, { once: true });

    // Hide address bar on mobile
    window.scrollTo(0, 1);

    return () => {
      window.removeEventListener('pointerdown', activateFullscreen);
      window.removeEventListener('keydown', activateFullscreen);
      window.removeEventListener('touchstart', activateFullscreen);
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
          <a href={`/booth?event=${DEMO_EVENT_SLUG}`}
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition">
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
