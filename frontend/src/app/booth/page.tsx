'use client';

import { useEffect, useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { getEvent } from '@/lib/api';
import { BoothMain } from '@/components/booth/BoothMain';
import Link from 'next/link';

export default function BoothPage({
  searchParams,
}: {
  searchParams: { event?: string };
}) {
  const { event, setEvent } = useBoothStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSlug = searchParams?.event;

  useEffect(() => {
    async function loadEvent() {
      if (!eventSlug) {
        setLoading(false);
        return;
      }
      try {
        const eventData = await getEvent(eventSlug);
        setEvent(eventData);
      } catch {
        setError('not_found');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventSlug, setEvent]);

  // Loading state
  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-lg">Loading booth...</p>
      </div>
    );
  }

  // No event slug provided
  if (!eventSlug) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-purple-600/20 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">No Event Selected</h2>
        <p className="text-white/50 mb-2">This booth needs an event to run.</p>
        <code className="text-purple-300 bg-black/40 px-4 py-2 rounded-lg text-sm mb-6">
          /booth?event=your-event-slug
        </code>
        <Link
          href="/admin"
          className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-white font-semibold transition-colors"
        >
          Go to Admin → Create Event
        </Link>
      </div>
    );
  }

  // Event not found
  if (error === 'not_found') {
    return (
      <div className="w-screen h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">🔍</div>
        <h2 className="text-2xl font-bold text-white mb-3">Event Not Found</h2>
        <p className="text-white/50 mb-2">
          No event with slug <code className="text-purple-300 bg-black/30 px-2 py-0.5 rounded">"{eventSlug}"</code> exists.
        </p>
        <p className="text-white/30 text-sm mb-6">Check the URL or create this event in the admin dashboard.</p>
        <Link
          href="/admin"
          className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-white font-semibold transition-colors"
        >
          Go to Admin Dashboard
        </Link>
      </div>
    );
  }

  // Event loaded — run the booth!
  return <BoothMain />;
}
