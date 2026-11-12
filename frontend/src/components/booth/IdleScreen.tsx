'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, Film, Zap, Settings, X, AlertCircle, Sparkles, RefreshCw, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { AttractScreenWrapper } from './AttractScreen';
import { operatorLogin, getBoothSession } from '@/lib/api';
import { getPendingCount, syncQueuedPhotos } from '@/lib/offlineQueue';
import toast from 'react-hot-toast';

export function IdleScreen() {
  const { event, setScreen, setMode, resetSession } = useBoothStore();

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

  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#8b5cf6';
  const eventName = (branding?.eventName as string) || event?.name || 'SnapBooth AI';
  const idleMediaUrl = (branding?.idleMediaUrl as string) || null;
  const isVideo = idleMediaUrl?.match(/\.(mp4|webm|mov)$/i);
  const logoUrl = (branding?.logoUrl as string) || null;

  // Check for time gates
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

  // Keep offline pending count updated when panel is open
  useEffect(() => {
    if (showPanel && event?.id) {
      getPendingCount(event.id).then(setOfflinePendingCount).catch(() => {});
    }
  }, [showPanel, event?.id]);

  const modes = [
    {
      mode: 'single' as const,
      label: 'Photo',
      icon: <Camera className="w-8 h-8 sm:w-9 sm:h-9" />,
      enabled: true,
      desc: 'Single High-Res Shot',
      badge: 'Classic',
      gradient: 'from-blue-600 via-indigo-600 to-violet-700',
      glow: 'rgba(99, 102, 241, 0.4)',
    },
    {
      mode: 'strip' as const,
      label: '4-Strip',
      icon: <Image className="w-8 h-8 sm:w-9 sm:h-9" />,
      enabled: true,
      desc: 'Retro 4-Pose Strip',
      badge: 'Popular',
      gradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
      glow: 'rgba(192, 38, 211, 0.4)',
    },
    {
      mode: 'gif' as const,
      label: 'GIF',
      icon: <Film className="w-8 h-8 sm:w-9 sm:h-9" />,
      enabled: settings?.allowGIF !== false,
      desc: 'Animated Burst',
      badge: 'Moving',
      gradient: 'from-pink-600 via-rose-600 to-purple-700',
      glow: 'rgba(244, 63, 94, 0.4)',
    },
    {
      mode: 'boomerang' as const,
      label: 'Boomerang',
      icon: <Zap className="w-8 h-8 sm:w-9 sm:h-9" />,
      enabled: settings?.allowBoomerang !== false,
      desc: 'Infinite Loop',
      badge: 'Fun',
      gradient: 'from-amber-500 via-orange-600 to-rose-600',
      glow: 'rgba(245, 158, 11, 0.4)',
    },
    {
      mode: 'aistudio' as const,
      label: 'AI Studio',
      icon: <Sparkles className="w-8 h-8 sm:w-9 sm:h-9" />,
      enabled: settings?.allowAI !== false,
      desc: 'Cinematic Transformations',
      badge: 'AI Magic',
      gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
      glow: 'rgba(20, 184, 166, 0.4)',
    },
  ].filter(m => m.enabled);

  function handleStart(mode: 'single' | 'gif' | 'boomerang' | 'strip' | 'aistudio') {
    if (gated) return;
    setMode(mode);
    setScreen('countdown');
  }

  function handleOperatorGear() {
    if (pinLocked) return;

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
  }

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
          console.warn('[IdleScreen] Booth session creation warning:', sessionErr);
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
    <div className="w-full h-full flex flex-col items-center justify-between p-6 sm:p-10 relative overflow-hidden select-none bg-[#07070d]">
      {/* Attract screen — shows after inactivity */}
      <AttractScreenWrapper
        eventName={eventName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        timeoutMs={120_000}
      />

      {/* Dynamic Ambient Background */}
      {idleMediaUrl ? (
        isVideo ? (
          <video src={idleMediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={idleMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[#07070d]" />
          {/* Subtle animated mesh gradients */}
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25 mix-blend-screen"
            style={{ background: primaryColor }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[650px] h-[650px] rounded-full blur-[140px] opacity-20 mix-blend-screen bg-indigo-600"
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] opacity-15 mix-blend-screen bg-fuchsia-600"
          />
          {/* Subtle noise/grid texture */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        </div>
      )}
      {idleMediaUrl && <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />}

      {/* Top Header Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Live Booth Ready</span>
        </div>

        {/* Operator gear button with glass styling */}
        <button
          onClick={handleOperatorGear}
          aria-label="Operator Settings"
          className="p-3 rounded-2xl glass-pill text-white/50 hover:text-white transition-all duration-200 active:scale-95 hover:border-white/20"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full my-auto py-6">
        {gated ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center glass-panel rounded-3xl p-10 max-w-md w-full border border-white/10"
          >
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-white text-2xl font-black mb-2">Booth Inactive</h2>
            <p className="text-white/70 text-base">{gateMessage}</p>
          </motion.div>
        ) : (
          <>
            {/* Event Brand Hero */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt={eventName} className="h-20 sm:h-24 w-auto object-contain mx-auto drop-shadow-2xl" />
              ) : (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-pill text-xs font-bold text-white/80 uppercase tracking-widest mb-2 border border-white/10">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Photobooth Experience
                  </div>
                  <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight drop-shadow-2xl">
                    {eventName}
                  </h1>
                </div>
              )}
              <p className="text-white/50 text-sm sm:text-base font-medium mt-3 tracking-wide">
                Touch below to capture your moment
              </p>
            </motion.div>

            {/* Single Big Button (when 1 mode configured) */}
            {modes.length === 1 ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleStart(modes[0].mode)}
                className="group relative w-60 h-60 sm:w-72 sm:h-72 rounded-full flex flex-col items-center justify-center text-white font-black text-2xl shadow-2xl transition-all cursor-pointer ring-8 ring-white/10 hover:ring-white/20"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)`,
                  boxShadow: `0 0 80px ${primaryColor}77`,
                }}
              >
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none" style={{ background: primaryColor }} />
                <Camera className="w-20 h-20 mb-3 group-hover:scale-110 transition-transform duration-300" />
                <span className="tracking-wider">TAP TO START</span>
                <span className="text-white/70 text-xs font-medium mt-1 uppercase tracking-widest">Touch screen</span>
              </motion.button>
            ) : (
              /* Multi-Mode Arcade Grid with Tactile 3D Feel */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 w-full max-w-4xl px-2">
                {modes.map((m, i) => (
                  <motion.button
                    key={m.mode}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + 0.06 * i, type: 'spring', damping: 20 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleStart(m.mode)}
                    className="relative group flex flex-col items-center justify-between p-5 sm:p-6 rounded-3xl glass-panel border border-white/10 hover:border-white/25 transition-all duration-300 cursor-pointer overflow-hidden min-h-[170px] sm:min-h-[190px]"
                    style={{
                      boxShadow: `0 12px 36px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)`,
                    }}
                  >
                    {/* Glowing highlight blob on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                      style={{ background: `radial-gradient(circle at center, ${m.glow} 0%, transparent 70%)` }}
                    />

                    {/* Mode pill badge */}
                    <span className="self-end text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70 group-hover:bg-white/20 transition-colors">
                      {m.badge}
                    </span>

                    {/* Icon with glowing backdrop */}
                    <div className="relative my-2">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${m.gradient} shadow-lg shadow-black/40 group-hover:scale-110 transition-transform duration-300`}
                      >
                        {m.icon}
                      </div>
                    </div>

                    {/* Text Details */}
                    <div className="text-center w-full z-10">
                      <h3 className="text-white font-bold text-base sm:text-lg tracking-tight group-hover:text-purple-300 transition-colors">
                        {m.label}
                      </h3>
                      <p className="text-white/40 text-[11px] font-medium truncate mt-0.5">
                        {m.desc}
                      </p>
                    </div>

                    {/* Bottom subtle indicator line */}
                    <div
                      className="absolute bottom-0 left-4 right-4 h-1 rounded-t-full opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(90deg, transparent, ${m.glow}, transparent)` }}
                    />
                  </motion.button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-20 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">
          Powered by <span className="text-white/70">SnapBooth AI</span>
        </p>
      </div>

      {/* PIN Pad Modal */}
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
              className="glass-panel border border-white/15 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 text-purple-400">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-white font-black text-xl mb-1">Operator Access</h3>
              <p className="text-white/40 text-xs mb-5 font-medium">
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
                          : 'glass-pill hover:bg-white/15 border border-white/10 active:bg-purple-600/30 disabled:opacity-30'
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

      {/* Operator Panel Modal */}
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
              className="glass-panel border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
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

                {/* Offline Queue Status and Manual Trigger */}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-pill hover:bg-white/20 text-white text-xs font-semibold transition-all active:scale-95"
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
                  className="w-full py-3.5 rounded-2xl glass-pill hover:bg-white/15 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-98"
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
