'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { IdleScreen } from './IdleScreen';
import { CountdownScreen } from './CountdownScreen';
import { PreviewScreen } from './PreviewScreen';
import { AIScreen } from './AIScreen';
import { ShareScreen } from './ShareScreen';
import { FlashOverlay } from './FlashOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Settings, X } from 'lucide-react';

export function BoothMain() {
  const { screen, event, resetSession, setScreen } = useBoothStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // Hidden operator access — triple-tap bottom-right corner
  const [cornerTaps, setCornerTaps] = useState(0);
  const [showOperatorPin, setShowOperatorPin] = useState(false);
  const [operatorPin, setOperatorPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCornerTap() {
    setCornerTaps(prev => {
      const next = prev + 1;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => setCornerTaps(0), 2000);
      if (next >= 3) {
        setCornerTaps(0);
        setShowOperatorPin(true);
        setOperatorPin('');
        setPinError(false);
      }
      return next;
    });
  }

  function handleOperatorPinSubmit() {
    const pin = (event?.settings as Record<string, unknown>)?.operatorPin as string;
    // If no PIN set, allow direct access; otherwise verify
    if (!pin || operatorPin === pin) {
      window.location.href = `/admin/events/${event?.id}`;
    } else {
      setPinError(true);
      setOperatorPin('');
      setTimeout(() => setPinError(false), 1500);
    }
  }

  // Connect to Socket.IO for real-time updates
  useEffect(() => {
    if (!event) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    socketRef.current = socket;

    socket.emit('join-event', event.id);

    socket.on('ai-status', ({ message }: { message: string }) => {
      useBoothStore.getState().setAIProgress(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [event]);

  // Session timeout - auto-reset after inactivity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const timeout = (event?.settings.sessionTimeout || 60) * 1000;

    if (screen !== 'idle') {
      timeoutRef.current = setTimeout(() => {
        resetSession();
      }, timeout);
    }
  }, [screen, event, resetSession]);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [screen, resetTimeout]);

  // Prevent context menu and text selection on iPad
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
    };
  }, []);

  const screens = {
    idle: <IdleScreen />,
    countdown: <CountdownScreen />,
    capture: <CountdownScreen />, // same component handles capture state
    preview: <PreviewScreen />,
    ai: <AIScreen />,
    share: <ShareScreen />,
    print: <ShareScreen />, // print is part of share screen
  };

  return (
    <div className="booth-container" onTouchStart={resetTimeout} onClick={resetTimeout}>

      {/* ── Hidden operator PIN overlay ── */}
      <AnimatePresence>
        {showOperatorPin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-3xl p-8 w-full max-w-sm text-center"
            >
              <button onClick={() => setShowOperatorPin(false)} className="absolute top-4 right-4 text-white/30 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <Settings className="w-10 h-10 text-purple-400 mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-1">Operator Access</h3>
              <p className="text-white/40 text-sm mb-6">
                {(event?.settings as Record<string,unknown>)?.operatorPin ? 'Enter PIN to manage this event' : 'Opening event manager…'}
              </p>
              {(event?.settings as Record<string,unknown>)?.operatorPin ? (
                <>
                  <input
                    type="password" inputMode="numeric" maxLength={8} value={operatorPin}
                    onChange={e => setOperatorPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleOperatorPinSubmit()}
                    placeholder="Enter PIN"
                    autoFocus
                    className={`w-full text-center text-2xl font-bold tracking-[0.5em] bg-white/5 border rounded-2xl px-4 py-4 text-white outline-none transition mb-4 ${pinError ? 'border-red-500 animate-pulse' : 'border-white/10 focus:border-purple-500'}`}
                  />
                  {pinError && <p className="text-red-400 text-sm mb-3">Incorrect PIN</p>}
                  <button onClick={handleOperatorPinSubmit}
                    className="w-full py-4 rounded-2xl font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                    Open Event Manager →
                  </button>
                </>
              ) : (
                <button onClick={handleOperatorPinSubmit}
                  className="w-full py-4 rounded-2xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                  Open Event Manager →
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Invisible operator tap zone (bottom-right corner) ── */}
      <button
        onClick={handleCornerTap}
        className="absolute bottom-0 right-0 w-16 h-16 z-50 opacity-0"
        aria-hidden="true"
      />
      <FlashOverlay />
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          {screens[screen] || screens.idle}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
