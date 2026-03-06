'use client';

/**
 * AttractScreen
 * Shown over the IdleScreen after IDLE_TIMEOUT_MS of no interaction.
 * Features:
 *   - Pulsing "Tap to Start" CTA with ripple rings
 *   - Animated event name / logo
 *   - Floating emoji particles
 *   - Auto-dismisses on any touch/click
 *
 * Usage in IdleScreen:
 *   <AttractScreen eventName={event.name} logoUrl={event.branding.logoUrl}
 *     primaryColor={event.branding.primaryColor} onDismiss={() => {}} />
 *
 * The parent IdleScreen should track idle time and mount/unmount this component.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IDLE_TIMEOUT_MS = 60_000; // 60 seconds before attract screen shows

const PARTICLES = ['📸', '✨', '🎉', '🌟', '💫', '🎊', '🎈', '❤️'];

interface AttractScreenProps {
  eventName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  onDismiss: () => void;
}

function AttractOverlay({ eventName, logoUrl, primaryColor = '#7c3aed', onDismiss }: AttractScreenProps) {
  const color = primaryColor;

  return (
    <motion.div
      key="attract"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: `radial-gradient(ellipse at center, ${color}22 0%, #0a0a0f 70%)` }}
      onPointerDown={onDismiss}
    >
      {/* Floating particles */}
      {PARTICLES.map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl sm:text-3xl select-none pointer-events-none"
          initial={{
            x: `${10 + (i * 11) % 80}vw`,
            y: '110vh',
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            y: '-10vh',
            rotate: i % 2 === 0 ? 360 : -360,
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: 6 + (i % 4),
            delay: i * 0.7,
            repeat: Infinity,
            repeatDelay: 2,
            ease: 'linear',
          }}
        >
          {emoji}
        </motion.div>
      ))}

      {/* Ripple rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 pointer-events-none"
          style={{ borderColor: `${color}55` }}
          initial={{ width: 80, height: 80, opacity: 0.8 }}
          animate={{ width: 400, height: 400, opacity: 0 }}
          transition={{
            duration: 3,
            delay: i * 1,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">

        {/* Logo or event name */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={eventName}
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-2xl" />
          ) : (
            <h1 className="text-white font-black text-3xl sm:text-5xl tracking-tight drop-shadow-2xl">
              {eventName}
            </h1>
          )}
        </motion.div>

        {/* Camera icon pulse */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl sm:text-8xl"
        >
          📸
        </motion.div>

        {/* Tap to start CTA */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6, type: 'spring' }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="px-10 py-5 rounded-2xl text-white font-black text-xl sm:text-2xl tracking-wide shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            TAP TO START
          </motion.div>
          <p className="text-white/40 text-sm">Touch anywhere to begin</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── useIdleTimer hook ─────────────────────────────────────────────────────────

export function useIdleTimer(timeoutMs = IDLE_TIMEOUT_MS) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setIsIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer immediately
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);

  return { isIdle, reset };
}

// ── AttractScreen: mounts when idle, dismisses on tap ─────────────────────────

export function AttractScreen(props: AttractScreenProps) {
  return (
    <AnimatePresence>
      <AttractOverlay {...props} />
    </AnimatePresence>
  );
}

// ── AttractScreenWrapper: self-managing idle timer ────────────────────────────
// Drop this into IdleScreen directly — it handles everything automatically.
//
// <AttractScreenWrapper
//   eventName={event.name}
//   logoUrl={event.branding.logoUrl}
//   primaryColor={event.branding.primaryColor}
// />

export function AttractScreenWrapper({
  eventName,
  logoUrl,
  primaryColor,
  timeoutMs = IDLE_TIMEOUT_MS,
}: Omit<AttractScreenProps, 'onDismiss'> & { timeoutMs?: number }) {
  const { isIdle, reset } = useIdleTimer(timeoutMs);

  return (
    <AnimatePresence>
      {isIdle && (
        <AttractOverlay
          eventName={eventName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          onDismiss={reset}
        />
      )}
    </AnimatePresence>
  );
}
