'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { haptic, sound, speak, flash, unlockAudio } from '@/lib/booth-sensory';

export function CountdownScreen() {
   const { event, setScreen } = useBoothStore();
  const seconds = (event?.settings?.countdownSeconds as number) || 3;

  const [count, setCount] = useState(seconds);
  const [capturing, setCapturing] = useState(false);
  const [smileShown, setSmileShown] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Unlock audio on first user-gesture-proximate effect
    unlockAudio();

    let remaining = seconds;
    setCount(remaining);

    // First tick immediately
    sound('beep');
    haptic('countdown');
    speak(String(remaining));

    const interval = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setCount(remaining);
        sound('beep');
        haptic('countdown');
        speak(String(remaining));
      } else {
        // 0 — capture!
        clearInterval(interval);
        setCount(0);
        setSmileShown(true);

        // Smile! voice + flash + shutter sound + strong haptic
        speak('Smile!', { rate: 1.1, pitch: 1.3 });
        sound('shutter');
        haptic('success');
        flash(200);

        // Small delay so flash is visible before photo is actually taken
        setTimeout(() => {
          setCapturing(true);
          sound('success');
          setScreen('capture');
        }, 120);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none">

      {/* Ripple rings on each beat */}
      <AnimatePresence mode="wait">
        {!smileShown && (
          <motion.div
            key={count}
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 120,
              height: 120,
              border: `3px solid ${primaryColor}`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Number */}
      <AnimatePresence mode="wait">
        {!smileShown ? (
          <motion.div
            key={count}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, duration: 0.35 }}
            className="relative z-10 font-black text-white select-none"
            style={{
              fontSize: 'clamp(120px, 30vw, 220px)',
              lineHeight: 1,
              textShadow: `0 0 60px ${primaryColor}99, 0 0 120px ${primaryColor}44`,
            }}
          >
            {count}
          </motion.div>
        ) : (
          <motion.div
            key="smile"
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="relative z-10 flex flex-col items-center gap-3"
          >
            <span className="text-6xl sm:text-8xl">😊</span>
            <p className="text-white font-black text-2xl sm:text-4xl tracking-widest">
              {capturing ? 'CAPTURING…' : 'SMILE!'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      {!smileShown && (
        <div className="absolute bottom-12 flex gap-3">
          {Array.from({ length: seconds }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i === seconds - count ? 1.4 : 1,
                opacity: i < seconds - count ? 0.25 : i === seconds - count ? 1 : 0.4,
              }}
              transition={{ duration: 0.2 }}
              className="w-3 h-3 rounded-full"
              style={{ background: i <= seconds - count ? primaryColor : 'rgba(255,255,255,0.3)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
