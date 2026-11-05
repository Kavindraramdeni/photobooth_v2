'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, Film, Zap, Settings, X, AlertCircle, Sparkles, RefreshCw, Lock, CheckCircle2 } from 'lucide-react';
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
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';
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
    { mode: 'single' as const, label: 'Photo',     icon: <Camera className="w-6 h-6" />,  enabled: true,                              desc: 'Single shot' },
    { mode: 'strip'  as const, label: '4-Strip',   icon: <Image  className="w-6 h-6" />,  enabled: true,                              desc: 'Film strip' },
    { mode: 'gif'    as const, label: 'GIF',        icon: <Film   className="w-6 h-6" />,  enabled: settings?.allowGIF !== false,      desc: 'Animated' },
    { mode: 'boomerang' as const, label: 'Boomerang', icon: <Zap  className="w-6 h-6" />,  enabled: settings?.allowBoomerang !== false, desc: 'Looping' },
    { mode: 'aistudio' as const, label: 'AI Art',    icon: <Sparkles className="w-6 h-6" />, enabled: settings?.allowAI !== false,        desc: 'AI Studio' },
  ].filter(m => m.enabled);

  function handleStart(mode: 'single' | 'gif' | 'boomerang' | 'strip' | 'aistudio') {
    if (gated) return;
    setMode(mode);
    setScreen('countdown');
  }

  function handleOperatorGear() {
    if (pinLocked) return;

    // Check if operator already holds a valid session token in sessionStorage
    const existingToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('operator_token') || (event?.id ? sessionStorage.getItem(`booth_token_${event.id}`) : null)
        : null;

    if (existingToken) {
      setShowPanel(true);
      return;
    }

    // Require genuine backend PIN authentication
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
      // Authenticate against backend operator-login endpoint
      const res = await operatorLogin(event.id, pinToSubmit);

      // Exchange for signed booth session token
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
      // Auto-submit on 4 digits (standard PIN length)
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
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden select-none">
      {/* Attract screen — shows after inactivity */}
      <AttractScreenWrapper
        eventName={eventName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        timeoutMs={120_000}
      />

      {/* Background */}
      {idleMediaUrl ? (
        isVideo
          ? <video src={idleMediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          : /* eslint-disable-next-line @next/next/no-img-element */
            <img src={idleMediaUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <>
          <div className="absolute inset-0 bg-[#0a0a0f]" />
          <div className="absolute inset-0 opacity-15" style={{ background: `radial-gradient(ellipse at center, ${primaryColor} 0%, transparent 70%)` }} />
          {[...Array(6)].map((_, i) => (
            <motion.div key={i} className="absolute rounded-full opacity-20"
              style={{ width: `${80 + 40 * i}px`, height: `${80 + 40 * i}px`, background: primaryColor, left: `${10 + 14 * i}%`, top: `${15 + 12 * i}%`, filter: 'blur(40px)' }}
              animate={{ y: [0, -20, 0], opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: 0.6 * i }}
            />
          ))}
        </>
      )}
      {idleMediaUrl && <div className="absolute inset-0 bg-black/50" />}

      {/* Operator gear button */}
      <button
        onClick={handleOperatorGear}
        aria-label="Operator Settings"
        className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-black/30 backdrop-blur-sm text-white/40 hover:text-white transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        {gated ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center bg-black/60 backdrop-blur-sm border border-white/10 rounded-3xl p-10">
            <AlertCircle className="w-14 h-14 text-white/40 mx-auto mb-4" />
            <p className="text-white/80 text-xl font-bold">{gateMessage}</p>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
              {logoUrl
                ? <img src={logoUrl} alt={eventName} className="h-16 w-auto object-contain drop-shadow-2xl mx-auto" />
                : <h1 className="text-4xl font-black text-white drop-shadow-xl tracking-tight">{eventName}</h1>
              }
            </motion.div>

            {modes.length === 1 ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.95 }} onClick={() => handleStart(modes[0].mode)}
                className="w-48 h-48 rounded-full flex flex-col items-center justify-center text-white font-black text-lg shadow-2xl mb-6 transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)`, boxShadow: `0 0 60px ${primaryColor}66` }}
              >
                <Camera className="w-12 h-12 mb-2" />
                TAP TO START
              </motion.button>
            ) : (
              <>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="text-white/60 text-lg mb-6 font-medium">Choose your mode</motion.p>
                <div className={`grid grid-cols-2 gap-3 w-full max-w-xs`}>
                  {modes.map((m, i) => (
                    <motion.button key={m.mode}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.08 * i }}
                      whileTap={{ scale: 0.93 }} onClick={() => handleStart(m.mode)}
                      className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-semibold text-white text-sm border-2 transition-all active:scale-95"
                      style={m.mode === 'aistudio'
                        ? { background: 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(168,85,247,0.25))', borderColor: 'rgba(139,92,246,0.6)', boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }
                        : { background: `${primaryColor}22`, borderColor: `${primaryColor}55`, boxShadow: `0 4px 20px ${primaryColor}22` }
                      }
                    >
                      <div style={{ color: m.mode === 'aistudio' ? '#a78bfa' : primaryColor }}>{m.icon}</div>
                      <span className="text-white font-bold">{m.label}</span>
                      <span className="text-white/40 text-xs">{m.desc}</span>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 1 }}
              className="text-white text-sm mt-6">Powered by SnapBooth AI</motion.p>
          </>
        )}
      </div>

      {/* PIN Pad Modal */}
      <AnimatePresence>
        {showPinPad && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#12121a] border border-white/10 rounded-2xl p-8 w-full max-w-xs text-center">
              <Settings className="w-8 h-8 text-white/40 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">Operator Access</h3>
              <p className="text-white/40 text-sm mb-4">
                {pinLocked ? `Locked. Try again in ${lockCountdown}s` : 'Enter Operator PIN'}
              </p>

              {pinErrorMessage && (
                <p className="text-red-400 text-xs mb-3 font-semibold">{pinErrorMessage}</p>
              )}

              <div className="flex justify-center gap-3 mb-6">
                {pinDots.map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      i < pinInput.length
                        ? (pinError ? 'bg-red-500 border-red-500' : 'border-current')
                        : 'border-white/20'
                    }`}
                    style={i < pinInput.length && !pinError ? { background: primaryColor, borderColor: primaryColor } : {}}
                  />
                ))}
              </div>

              {isAuthenticating ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/60 text-xs mt-2">Verifying PIN...</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k, i) => (
                    <button
                      key={i}
                      disabled={pinLocked || isAuthenticating}
                      onClick={() => handlePinKey(String(k))}
                      className={`py-4 rounded-xl text-white font-bold text-lg transition-all active:scale-90 ${
                        k === '' ? 'opacity-0 pointer-events-none' : 'bg-white/10 hover:bg-white/20 disabled:opacity-40'
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
                className="text-white/40 text-sm hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operator Panel Modal */}
      <AnimatePresence>
        {showPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚙️</span>
                  <h3 className="text-white font-bold text-lg">Operator Panel</h3>
                </div>
                <button onClick={() => setShowPanel(false)}>
                  <X className="w-5 h-5 text-white/40 hover:text-white" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-white/50 text-xs">Event</p>
                    <p className="text-white font-semibold text-sm truncate max-w-[200px]">{event?.name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Unlocked</span>
                  </div>
                </div>

                {/* Offline Queue Status and Manual Trigger */}
                <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-white/50 text-xs">Offline Captures</p>
                    <p className="text-white font-semibold text-sm">
                      {offlinePendingCount === 0 ? 'All synced' : `${offlinePendingCount} pending sync`}
                    </p>
                  </div>
                  <button
                    disabled={isManualSyncing}
                    onClick={handleManualSync}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
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
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Reset Session
                </button>

                <a
                  href={`/admin/events/${event?.id}?operator=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-purple-600/20 text-purple-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-purple-600/30 transition-all"
                >
                  <Settings className="w-4 h-4" /> Open Event Manager
                </a>

                <button
                  onClick={handleLockOperator}
                  className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Lock Operator Access
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
