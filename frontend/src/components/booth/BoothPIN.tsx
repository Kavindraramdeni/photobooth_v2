'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete } from 'lucide-react';

interface BoothPINProps {
  correctPin: string;
  eventName: string;
  brandColor?: string;
  onUnlocked: () => void;
}

export function BoothPIN({ correctPin, eventName, brandColor = '#7c3aed', onUnlocked }: BoothPINProps) {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (entered.length === correctPin.length) {
      if (entered === correctPin) {
        onUnlocked();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setEntered('');
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 5) {
            setLocked(true);
            setLockTimer(30);
            timerRef.current = setInterval(() => {
              setLockTimer((t) => {
                if (t <= 1) {
                  clearInterval(timerRef.current!);
                  setLocked(false);
                  setAttempts(0);
                  return 0;
                }
                return t - 1;
              });
            }, 1000);
          }
        }, 600);
      }
    }
  }, [entered, correctPin, attempts, onUnlocked]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function press(digit: string) {
    if (locked || entered.length >= correctPin.length) return;
    setEntered((p) => p + digit);
  }

  function del() {
    setEntered((p) => p.slice(0, -1));
  }

  const dots = Array.from({ length: correctPin.length }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] select-none"
      style={{ background: `radial-gradient(ellipse at center, ${brandColor}18 0%, #0a0a0f 70%)` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 w-full max-w-xs px-6"
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${brandColor}22`, border: `1px solid ${brandColor}44` }}
        >
          <Lock className="w-8 h-8" style={{ color: brandColor }} />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{eventName}</h1>
          <p className="text-white/40 text-sm mt-1">
            {locked ? `Too many attempts — wait ${lockTimer}s` : 'Enter operator PIN to start'}
          </p>
        </div>

        {/* PIN dots */}
        <motion.div
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.5 }}
          className="flex gap-4"
        >
          {dots.map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all duration-150"
              style={{
                background: i < entered.length ? brandColor : 'transparent',
                borderColor: i < entered.length ? brandColor : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </motion.div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
            if (key === '') return <div key={idx} />;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.92 }}
                onClick={() => key === '⌫' ? del() : press(key)}
                disabled={locked}
                className="aspect-square rounded-2xl text-xl font-semibold text-white flex items-center justify-center transition-colors disabled:opacity-30"
                style={{
                  background: key === '⌫' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
              </motion.button>
            );
          })}
        </div>

        {attempts > 0 && attempts < 5 && (
          <p className="text-red-400/70 text-xs">
            Incorrect PIN — {5 - attempts} attempt{5 - attempts !== 1 ? 's' : ''} remaining
          </p>
        )}
      </motion.div>
    </div>
  );
}
