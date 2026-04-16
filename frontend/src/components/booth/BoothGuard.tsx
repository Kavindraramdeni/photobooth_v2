'use client';

/**
 * BoothGuard
 * Wraps the booth and shows friendly gates when:
 *   1. Current time is before event.settings.boothStart
 *   2. Current time is after event.settings.boothEnd
 *   3. Photo count has reached event.settings.photoLimit
 *
 * Usage — wrap BoothMain inside BoothGuard in the booth page:
 *
 *   // app/booth/page.tsx (or wherever your booth root is)
 *   import { BoothGuard } from '@/components/booth/BoothGuard';
 *   import { BoothMain } from '@/components/booth/BoothMain';
 *
 *   export default function BoothPage() {
 *     return (
 *       <BoothGuard>
 *         <BoothMain />
 *       </BoothGuard>
 *     );
 *   }
 */

import { useEffect, useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { getPhotoCount } from '@/lib/api';

type GuardState = 'loading' | 'too_early' | 'ended' | 'limit_reached' | 'ok';

function GatePage({ emoji, title, subtitle, color = '#7c3aed' }: {
  emoji: string; title: string; subtitle: string; color?: string;
}) {
  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${color}18 0%, transparent 70%)` }} />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative z-10 flex flex-col items-center gap-6 max-w-sm"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl sm:text-8xl"
        >
          {emoji}
        </motion.div>

        <div>
          <h1 className="text-white font-black text-2xl sm:text-3xl mb-2">{title}</h1>
          <p className="text-white/45 text-base sm:text-lg leading-relaxed">{subtitle}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function BoothGuard({ children }: { children: ReactNode }) {
  const { event } = useBoothStore();
  const [state, setState] = useState<GuardState>('loading');
  const [timeUntilStart, setTimeUntilStart] = useState('');

  useEffect(() => {
    if (!event) { setState('ok'); return; }

    async function check() {
      const settings = (event!.settings || {}) as Record<string, unknown>;
      const boothStart   = settings.boothStart  as string | null;
      const boothEnd     = settings.boothEnd    as string | null;
      const photoLimit   = settings.photoLimit  as number | null;

      const now = new Date();

      // ── Time gate: too early ──────────────────────────────────────────
      if (boothStart) {
        const start = new Date(boothStart);
        if (now < start) {
          // Compute time until start for display
          const diffMs = start.getTime() - now.getTime();
          const h = Math.floor(diffMs / 3_600_000);
          const m = Math.floor((diffMs % 3_600_000) / 60_000);
          setTimeUntilStart(
            h > 0 ? `Opens in ${h}h ${m}m` : `Opens in ${m} minute${m !== 1 ? 's' : ''}`
          );
          setState('too_early');
          return;
        }
      }

      // ── Time gate: ended ──────────────────────────────────────────────
      if (boothEnd) {
        const end = new Date(boothEnd);
        if (now > end) {
          setState('ended');
          return;
        }
      }

      // ── Photo count limit ─────────────────────────────────────────────
      if (photoLimit && photoLimit > 0) {
        try {
          const count = await getPhotoCount(event!.id);
          if (count >= photoLimit) {
            setState('limit_reached');
            return;
          }
        } catch { /* if count check fails, let booth continue */ }
      }

      setState('ok');
    }

    check();

    // Re-check every 30 seconds in case booth start time arrives while screen is open
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [event]);

  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';
  const eventName    = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  if (state === 'loading') return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (state === 'too_early') return (
    <GatePage
      emoji="⏰"
      title="Booth opens soon"
      subtitle={`${eventName} · ${timeUntilStart}`}
      color={primaryColor}
    />
  );

  if (state === 'ended') return (
    <GatePage
      emoji="🎉"
      title="Event has ended"
      subtitle={`Thank you for being part of ${eventName}! Your photos are ready to share.`}
      color={primaryColor}
    />
  );

  if (state === 'limit_reached') return (
    <GatePage
      emoji="📷"
      title="Photo limit reached"
      subtitle="We've captured the maximum number of photos for this event. Thank you!"
      color={primaryColor}
    />
  );

  // All clear — render the booth
  return <>{children}</>;
}
