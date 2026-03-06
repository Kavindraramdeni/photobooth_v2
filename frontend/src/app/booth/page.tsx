'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBoothStore } from '@/lib/store';
import { getEvent } from '@/lib/api';

export default function BoothPage() {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get('event');

  const { event, setEvent } = useBoothStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      if (!eventSlug) {
        setLoading(false);
        return;
      }

      try {
        const eventData = await getEvent(eventSlug);
        setEvent(eventData);
      } catch (err) {
        setError('Event not found. Please check your event link.');
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventSlug, setEvent]);

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
          <p className="text-sm text-white/40">
            URL format: /booth?event=your-event-slug
          </p>
        </div>
      </div>
    );
  }

  if (!event && !eventSlug) {
    return <DemoMode />;
  }

  return (
    <BoothErrorBoundary>
      <BoothGuard>
        <BoothMain />
      </BoothGuard>
    </BoothErrorBoundary>
  );
}

// Demo mode when no event is specified
function DemoMode() {
  return (
    <div className="booth-container items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-full ai-gradient flex items-center justify-center glow-purple">
            <Camera className="w-12 h-12 text-white" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 float-animation" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-3">SnapBooth AI</h1>
        <p className="text-white/60 text-lg mb-8">
          Professional AI-powered photobooth for unforgettable events
        </p>

        <div className="bg-white/5 rounded-2xl p-6 text-left space-y-3 border border-white/10">
          <p className="text-white/80 font-medium">To launch a booth:</p>
          <code className="block bg-black/40 rounded-lg p-3 text-purple-300 text-sm">
            /booth?event=your-event-slug
          </code>
          <p className="text-white/50 text-sm">
            Create events in the{' '}
            <a href="/admin" className="text-purple-400 underline">
              Admin Dashboard
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
