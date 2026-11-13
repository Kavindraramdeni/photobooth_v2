'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Settings, X, AlertCircle, RefreshCw, Lock, CheckCircle2, ChevronRight, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { operatorLogin, getBoothSession } from '@/lib/api';
import { getPendingCount, syncQueuedPhotos } from '@/lib/offlineQueue';
import toast from 'react-hot-toast';

export function IdleScreen() {
  const { event, setScreen, resetSession } = useBoothStore();

  // Operator panel state
  const [showPanel, setShowPanel] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [pinLocked, setPinLocked] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Secret corner operator trigger (long press or multi-tap)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';
  const themeMode = (branding?.themeMode as string) || 'light';
  const isLight = themeMode === 'light';
  const eventName = (branding?.eventName as string) || event?.name || 'SnapBooth';
  const logoUrl = (branding?.logoUrl as string) || null;

  // Time gating checks
  const [gated, setGated] = useState(false);
  const [gateMessage, setGateMessage] = useState('');

  useEffect(() => {
    const boothStart = settings?.boothStart as string | null;
    const boothEnd = settings?.boothEnd as string | null;
    if (boothStart && new Date() < new Date(boothStart)) {
      setGated(true);
      setGateMessage(`Booth opens at ${new Date(boothStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } else if (boothEnd && new Date() > new Date(boothEnd)) {
      setGated(true);
      setGateMessage('This event has ended. Thank you for joining us!');
    }
  }, [settings]);

  useEffect(() => {
    if (showPanel && event?.id) {
      getPendingCount(event.id).then(setOfflinePendingCount).catch(() => {});
    }
  }, [showPanel, event?.id]);

  // Secret corner triggers
  const handleCornerTouchStart = () => {
    if (pinLocked) return;
    longPressTimerRef.current = setTimeout(() => {
      openOperatorModal();
    }, 1200);
  };

  const handleCornerTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCornerClick = () => {
    if (pinLocked) return;
    tapCountRef.current += 1;
    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1000);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      openOperatorModal();
    }
  };

  const openOperatorModal = () => {
    const existingToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('operator_token') || (event?.id ? sessionStorage.getItem(`booth_token_${event.id}`) : null)
        : null;

    if (existingToken) {
      setShowPanel(true);
      return;
    }

    setShowPinPad(true);
    setPinInput('');
    setPinError(false);
    setPinErrorMessage('');
  };

  async function submitPin(pinToSubmit: string) {
    if (!event?.id) {
      toast.error('No active event loaded');
      return;
    }

    setIsAuthenticating(true);
    setPinError(false);
    setPinErrorMessage('');

    try {
      const res = await operatorLogin(event.id, pinToSubmit);

      if (res?.token) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('operator_token', res.token);
        }
        try {
          await getBoothSession(event.id, res.token);
        } catch (sessionErr) {
          console.warn('[IdleScreen] Booth session warning:', sessionErr);
        }

        toast.success('Operator authenticated', { icon: '🔓' });
        setShowPinPad(false);
        setShowPanel(true);
        setPinInput('');
        setPinAttempts(0);
      }
    } catch (err: any) {
      const is401 = err?.response?.status === 401;
      const errorMsg = is401 ? 'Invalid Operator PIN' : (err?.response?.data?.error || err?.message || 'Authentication failed');

      setPinError(true);
      setPinErrorMessage(errorMsg);
      toast.error(errorMsg);
      setPinInput('');

      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);

      if (attempts >= 5) {
        setPinLocked(true);
        setLockCountdown(30);
        lockTimerRef.current = setInterval(() => {
          setLockCountdown((c) => {
            if (c <= 1) {
              if (lockTimerRef.current) clearInterval(lockTimerRef.current);
              setPinLocked(false);
              setPinAttempts(0);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      } else {
        setTimeout(() => setPinError(false), 1200);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handlePinKey(key: string) {
    if (isAuthenticating || pinLocked) return;
    if (key === '⌫') {
      setPinInput((p) => p.slice(0, -1));
      return;
    }
    if (key === '') return;

    const next = pinInput + key;
    if (next.length <= 6) {
      setPinInput(next);
      if (next.length === 4) {
        submitPin(next);
      }
    }
  }

  async function handleManualSync() {
    if (!event?.id) return;
    setIsManualSyncing(true);
    try {
      const result = await syncQueuedPhotos(undefined, event.id);
      toast.success(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
      const count = await getPendingCount(event.id);
      setOfflinePendingCount(count);
    } catch (err: any) {
      toast.error(`Sync error: ${err?.message || 'Network failure'}`);
    } finally {
      setIsManualSyncing(false);
    }
  }

  function handleLockOperator() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('operator_token');
      sessionStorage.removeItem('booth_token');
      if (event?.id) {
        sessionStorage.removeItem(`booth_token_${event.id}`);
      }
    }
    setShowPanel(false);
    setShowPinPad(false);
    setPinInput('');
    toast('Operator locked', { icon: '🔒' });
  }

  const pinDots = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden select-none z-10">
      {/* Secret Operator Corner Zone (Top-Right): No intrusive guest UI, long-press or 3 taps to open */}
      <div
        className="absolute top-0 right-0 w-28 h-28 z-40 cursor-default"
        onTouchStart={handleCornerTouchStart}
        onTouchEnd={handleCornerTouchEnd}
        onMouseDown={handleCornerTouchStart}
        onMouseUp={handleCornerTouchEnd}
        onClick={handleCornerClick}
        aria-hidden="true"
      />

      {/* Main Attract Centerpiece */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl mx-auto w-full my-auto text-center px-4">
        {gated ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-10 rounded-3xl max-w-md w-full border shadow-2xl ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181938] border-slate-700 text-white'
            }`}
          >
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-2">Booth Inactive</h2>
            <p className={`text-base font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{gateMessage}</p>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-10 sm:space-y-12">
            {/* Event Brand Hero: Crisp & Cinematic */}
            <div className="flex flex-col items-center justify-center">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt={eventName}
                  className="h-24 sm:h-36 max-w-xs sm:max-w-md object-contain mx-auto filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.15)]"
                />
              ) : (
                <div className="space-y-2">
                  <span className={`text-[11px] sm:text-xs font-black tracking-[0.28em] uppercase ${
                    isLight ? 'text-purple-600' : 'text-purple-400'
                  }`}>
                    Interactive Photobooth Experience
                  </span>
                  <h1
                    className={`text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-none drop-shadow-sm ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {eventName}
                  </h1>
                </div>
              )}
            </div>

            {/* Studio Shutter Trigger: Physical, Tactile, Luminous */}
            <div className="relative flex items-center justify-center pt-2">
              {/* Outer Breathing Radial Halo */}
              <div
                className="absolute w-64 h-64 sm:w-72 sm:h-72 rounded-full animate-ping opacity-20 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full blur-2xl opacity-40 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
              />

              {/* Physical Studio Ring Button */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const leadEnabled = Boolean((settings as Record<string, unknown>)?.enableLeadCapture);
                  const gatingMode = String((settings as Record<string, unknown>)?.leadGatingMode || 'before_capture');
                  if (leadEnabled && gatingMode === 'before_capture') {
                    setScreen('lead');
                  } else {
                    setScreen('style');
                  }
                }}
                className="relative z-10 w-52 h-52 sm:w-60 sm:h-60 rounded-full flex flex-col items-center justify-center text-white font-black shadow-2xl cursor-pointer border-4 border-white/30 transition-all btn-arcade group"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, #4338ca)`,
                  boxShadow: `0 24px 60px ${primaryColor}66, inset 0 2px 4px rgba(255,255,255,0.4)`,
                }}
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Camera className="w-9 h-9 sm:w-11 sm:h-11 text-white" />
                </div>
                <span className="text-xl sm:text-2xl font-black tracking-wider uppercase">
                  Tap to Start
                </span>
                <span className="text-[11px] font-bold tracking-widest text-white/80 uppercase mt-0.5">
                  Touch screen
                </span>
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Operator PIN Pad Modal */}
      <AnimatePresence>
        {showPinPad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[#181938] border-2 border-slate-700/80 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 text-purple-400">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-white font-black text-xl mb-1">Operator Access</h3>
              <p className="text-white/50 text-xs mb-5 font-medium">
                {pinLocked ? `Locked. Try again in ${lockCountdown}s` : 'Enter 4-digit operator PIN'}
              </p>

              {pinErrorMessage && (
                <div className="mb-4 py-2 px-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                  {pinErrorMessage}
                </div>
              )}

              {/* PIN Dots */}
              <div className="flex justify-center gap-4 mb-6">
                {pinDots.map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      i < pinInput.length
                        ? (pinError ? 'bg-red-500 border-red-500 scale-125' : 'bg-purple-500 border-purple-500 scale-110 shadow-[0_0_12px_rgba(168,85,247,0.7)]')
                        : 'border-white/20 bg-white/5'
                    }`}
                  />
                ))}
              </div>

              {isAuthenticating ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/60 text-xs font-medium">Verifying credentials...</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k, i) => (
                    <button
                      key={i}
                      disabled={pinLocked || isAuthenticating}
                      onClick={() => handlePinKey(String(k))}
                      className={`h-14 rounded-2xl text-white font-bold text-xl transition-all active:scale-90 flex items-center justify-center ${
                        k === ''
                          ? 'opacity-0 pointer-events-none'
                          : 'bg-white/10 hover:bg-white/15 border border-white/10 active:bg-purple-600/30 disabled:opacity-30'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setShowPinPad(false);
                  setPinInput('');
                  setPinError(false);
                  setPinErrorMessage('');
                }}
                className="text-white/40 text-xs font-semibold hover:text-white transition-colors"
              >
                Cancel &amp; Return
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operator Hub Panel Modal */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="bg-[#181938] border-2 border-slate-700/80 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">Operator Hub</h3>
                    <p className="text-white/40 text-xs">Booth Controls</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex justify-between items-center">
                  <div>
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider">Active Event</p>
                    <p className="text-white font-bold text-sm truncate max-w-[180px]">{event?.name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Live</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex justify-between items-center">
                  <div>
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider">Offline Sync</p>
                    <p className="text-white font-semibold text-sm">
                      {offlinePendingCount === 0 ? 'All photos synced' : `${offlinePendingCount} pending`}
                    </p>
                  </div>
                  <button
                    disabled={isManualSyncing}
                    onClick={handleManualSync}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    resetSession();
                    setShowPanel(false);
                    toast.success('Session reset');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <RefreshCw className="w-4 h-4 text-purple-400" /> Reset Booth State
                </button>

                <a
                  href={`/admin/events/${event?.id}?operator=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-98"
                >
                  <Settings className="w-4 h-4" /> Open Full Admin Hub <ChevronRight className="w-4 h-4 ml-1" />
                </a>

                <button
                  onClick={handleLockOperator}
                  className="w-full py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" /> Lock Operator Access
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
