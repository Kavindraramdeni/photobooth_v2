'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, Film, Image, Settings, X, AlertCircle } from 'lucide-react';
import { useBoothStore, BoothMode } from '@/lib/store';

export function IdleScreen() {
  const { event, setScreen, setMode, resetSession } = useBoothStore();
  const [showOperatorPanel, setShowOperatorPanel] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [boothLocked, setBoothLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');

  const branding  = event?.branding;
  const settings  = event?.settings;
  const primaryColor  = (branding?.primaryColor as string) || '#7c3aed';
  const eventName = (branding?.eventName as string) || event?.name || 'SnapBooth AI';
  const idleMediaUrl = (branding?.idleMediaUrl as string) || null;
  const isVideo   = idleMediaUrl?.match(/\.(mp4|webm|mov)$/i);
  const logoUrl   = (branding?.logoUrl as string) || null;

  // Check booth time limits
  useEffect(() => {
    const boothStart = settings?.boothStart as string | null;
    const boothEnd   = settings?.boothEnd   as string | null;
    const photoLimit = settings?.photoLimit  as number | null;

    if (boothStart && new Date() < new Date(boothStart)) {
      setBoothLocked(true);
      setLockMessage(`Booth opens at ${new Date(boothStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } else if (boothEnd && new Date() > new Date(boothEnd)) {
      setBoothLocked(true);
      setLockMessage('This event has ended. Thank you for joining us!');
    }
  }, [settings]);

  const modes: { mode: BoothMode; label: string; icon: React.ReactNode; enabled: boolean; desc: string }[] = [
    { mode: 'single',    label: 'Photo',     icon: <Camera className="w-6 h-6" />, enabled: true, desc: 'Single shot' },
    { mode: 'strip',     label: '4-Strip',   icon: <Image className="w-6 h-6" />,  enabled: true, desc: 'Film strip' },
    { mode: 'gif',       label: 'GIF',       icon: <Film className="w-6 h-6" />,   enabled: settings?.allowGIF !== false, desc: 'Animated' },
    { mode: 'boomerang', label: 'Boomerang', icon: <Zap className="w-6 h-6" />,    enabled: settings?.allowBoomerang !== false, desc: 'Looping' },
  ].filter(m => m.enabled);

  function handleStart(mode: BoothMode) {
    if (boothLocked) return;
    setMode(mode);
    setScreen('countdown');
  }

  function handleGearPress() {
    const pin = (settings?.operatorPin as string) || '1234';
    if (pinUnlocked) {
      setShowOperatorPanel(true);
    } else {
      setShowPinEntry(true);
      setPinInput('');
      setPinError(false);
    }
  }

  function handlePinDigit(d: string) {
    const next = pinInput + d;
    const pin  = (settings?.operatorPin as string) || '1234';
    if (next.length === pin.length) {
      if (next === pin) {
        setPinUnlocked(true);
        setShowPinEntry(false);
        setShowOperatorPanel(true);
        setPinInput('');
      } else {
        setPinError(true);
        setTimeout(() => { setPinError(false); setPinInput(''); }, 800);
      }
    } else {
      setPinInput(next);
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden select-none">

      {/* Background */}
      {idleMediaUrl ? (
        isVideo ? (
          <video src={idleMediaUrl} autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idleMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        <>
          <div className="absolute inset-0 bg-[#0a0a0f]" />
          <div className="absolute inset-0 opacity-15"
            style={{ background: `radial-gradient(ellipse at center, ${primaryColor} 0%, transparent 70%)` }} />
          {/* Animated dots */}
          {[...Array(6)].map((_, i) => (
            <motion.div key={i}
              className="absolute rounded-full opacity-20"
              style={{
                width: `${80 + i * 40}px`, height: `${80 + i * 40}px`,
                background: primaryColor, left: `${10 + i * 14}%`, top: `${15 + i * 12}%`,
                filter: 'blur(40px)',
              }}
              animate={{ y: [0, -20, 0], opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.6 }}
            />
          ))}
        </>
      )}

      {idleMediaUrl && <div className="absolute inset-0 bg-black/50" />}

      {/* Gear / operator button — top right corner */}
      <button
        onClick={handleGearPress}
        className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-black/30 backdrop-blur-sm text-white/30 hover:text-white/70 transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

        {/* Booth locked state */}
        {boothLocked ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center bg-black/60 backdrop-blur-sm border border-white/10 rounded-3xl p-10">
            <AlertCircle className="w-14 h-14 text-white/40 mx-auto mb-4" />
            <p className="text-white/80 text-xl font-bold">{lockMessage}</p>
          </motion.div>
        ) : (
          <>
            {/* Logo / Event name */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="mb-8 text-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={eventName} className="h-16 w-auto object-contain drop-shadow-2xl mx-auto" />
              ) : (
                <h1 className="text-4xl font-black text-white drop-shadow-xl tracking-tight">{eventName}</h1>
              )}
            </motion.div>

            {/* Tap to start — single mode shortcut */}
            {modes.length === 1 ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleStart(modes[0].mode)}
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

                <div className={`grid ${modes.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'} gap-3 w-full max-w-xs`}>
                  {modes.map((m, i) => (
                    <motion.button
                      key={m.mode}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleStart(m.mode)}
                      className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-semibold text-white text-sm border-2 transition-all active:scale-95"
                      style={{
                        background: `${primaryColor}22`,
                        borderColor: `${primaryColor}55`,
                        boxShadow: `0 4px 20px ${primaryColor}22`,
                      }}
                    >
                      <div style={{ color: primaryColor }}>{m.icon}</div>
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

      {/* PIN entry modal */}
      <AnimatePresence>
        {showPinEntry && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#12121a] border border-white/10 rounded-2xl p-8 w-full max-w-xs text-center">
              <Settings className="w-8 h-8 text-white/40 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">Operator Access</h3>
              <p className="text-white/40 text-sm mb-5">Enter your PIN</p>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-6">
                {Array.from({ length: ((settings?.operatorPin as string) || '1234').length }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    i < pinInput.length
                      ? pinError ? 'bg-red-500 border-red-500' : `border-current`
                      : 'border-white/20'
                  }`} style={i < pinInput.length && !pinError ? { background: primaryColor, borderColor: primaryColor } : {}} />
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
                  <button key={i}
                    onClick={() => {
                      if (d === '⌫') setPinInput(p => p.slice(0, -1));
                      else if (d !== '') handlePinDigit(String(d));
                    }}
                    className={`py-4 rounded-xl text-white font-bold text-lg transition-all active:scale-90 ${
                      d === '' ? 'opacity-0 pointer-events-none' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPinEntry(false)} className="text-white/40 text-sm hover:text-white/70 transition-colors">
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operator panel */}
      <AnimatePresence>
        {showOperatorPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">⚙️ Operator Panel</h3>
                <button onClick={() => setShowOperatorPanel(false)}>
                  <X className="w-5 h-5 text-white/40 hover:text-white" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/50 text-xs">Event</p>
                  <p className="text-white font-semibold">{event?.name || '—'}</p>
                </div>

                <button
                  onClick={() => { resetSession(); setShowOperatorPanel(false); }}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                >
                  🔄 Reset Session
                </button>

                <a href="/admin" target="_blank"
                  className="w-full py-3 rounded-xl bg-purple-600/20 text-purple-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-purple-600/30 transition-all"
                >
                  <Settings className="w-4 h-4" /> Open Admin Panel
                </a>

                <button
                  onClick={() => { setPinUnlocked(false); setShowOperatorPanel(false); }}
                  className="w-full py-3 rounded-xl text-white/30 text-sm hover:text-white/60 transition-colors"
                >
                  Lock operator access
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
