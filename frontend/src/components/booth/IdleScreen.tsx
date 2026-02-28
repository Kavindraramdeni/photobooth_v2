'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, Film, Image, Settings, X, Delete } from 'lucide-react';
import { useBoothStore, BoothMode } from '@/lib/store';
import { useRef, useState, useEffect } from 'react';
import { OperatorPanel } from './OperatorPanel';

export function IdleScreen() {
  const { event, setScreen, setMode } = useBoothStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [tapPrompt, setTapPrompt] = useState(true);

  // PIN modal state
  const [showPinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = branding?.primaryColor || '#7c3aed';
  const eventName = branding?.eventName || 'SnapBooth AI';

  const idleMediaUrl = (branding as any)?.idleMediaUrl || null;
  const isVideo = idleMediaUrl && /\.(mp4|webm|mov)$/i.test(idleMediaUrl);
  const correctPin = settings?.operatorPin || '1234';

  // Pulse tap prompt
  useEffect(() => {
    const t = setInterval(() => setTapPrompt((v) => !v), 1200);
    return () => clearInterval(t);
  }, []);

  // Autoplay video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => setMediaError(true));
    }
  }, [idleMediaUrl]);

  const modes: { mode: BoothMode; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { mode: 'single' as BoothMode, label: 'Photo', icon: <Camera className="w-7 h-7" />, enabled: true },
    { mode: 'strip' as BoothMode, label: '4-Strip', icon: <Image className="w-7 h-7" />, enabled: true },
    { mode: 'gif' as BoothMode, label: 'GIF', icon: <Film className="w-7 h-7" />, enabled: settings?.allowGIF !== false },
    { mode: 'boomerang' as BoothMode, label: 'Boomerang', icon: <Zap className="w-7 h-7" />, enabled: settings?.allowBoomerang !== false },
  ].filter((m) => m.enabled);

  function handleStart(mode: BoothMode) {
    if (showPinModal || showPanel) return;
    setMode(mode);
    setScreen('countdown');
  }

  function handleGearPress() {
    setPinModal(true);
    setPin('');
    setPinError(false);
  }

  function handlePinDigit(digit: string) {
    if (pin.length >= 8) return;
    const newPin = pin + digit;
    setPin(newPin);

    // Auto-check when pin reaches correct length
    if (newPin.length === correctPin.length) {
      if (newPin === correctPin) {
        setPinModal(false);
        setPin('');
        setPinError(false);
        setShowPanel(true);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 800);
      }
    }
  }

  function handlePinDelete() {
    setPin((p) => p.slice(0, -1));
    setPinError(false);
  }

  // ── PIN Modal ──────────────────────────────────────────────────────────────
  const PinModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { setPinModal(false); setPin(''); setPinError(false); }}
        className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xs"
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center mx-auto mb-6">
          <Settings className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-white text-2xl font-bold text-center mb-2">Operator Access</h2>
        <p className="text-white/40 text-sm text-center mb-8">Enter your PIN to continue</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-8">
          {Array.from({ length: Math.max(correctPin.length, 4) }).map((_, i) => (
            <motion.div
              key={i}
              animate={pinError ? { x: [-4, 4, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? pinError ? 'bg-red-500 border-red-500' : 'bg-purple-400 border-purple-400'
                  : 'bg-transparent border-white/30'
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            key === '' ? <div key={i} /> :
            key === '⌫' ? (
              <button
                key={i}
                onClick={handlePinDelete}
                className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            ) : (
              <button
                key={i}
                onClick={() => handlePinDigit(key)}
                className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white text-2xl font-semibold"
              >
                {key}
              </button>
            )
          ))}
        </div>

        {pinError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm text-center mt-4"
          >
            Incorrect PIN. Try again.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );

  // ── Fullscreen idle video/image ────────────────────────────────────────────
  if (idleMediaUrl && !mediaError) {
    return (
      <>
        <div
          className="w-full h-full relative overflow-hidden bg-black cursor-pointer select-none"
          onClick={() => handleStart('single')}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={idleMediaUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay loop muted playsInline
              onError={() => setMediaError(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idleMediaUrl} alt="Idle" className="absolute inset-0 w-full h-full object-cover" onError={() => setMediaError(true)} />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Event name */}
          <div className="absolute top-8 left-0 right-0 text-center z-10">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={eventName} className="h-16 w-auto mx-auto object-contain drop-shadow-lg" />
            ) : (
              <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-tight">{eventName}</h1>
            )}
          </div>

          {/* Tap to start */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-12 z-10"
            animate={{ opacity: tapPrompt ? 1 : 0.4 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div animate={{ scale: tapPrompt ? 1.05 : 0.97 }} transition={{ duration: 0.6 }} className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                <Camera className="w-10 h-10 text-white" />
              </div>
              <p className="text-white text-3xl font-black tracking-wide drop-shadow-lg">TAP ANYWHERE TO START</p>
              <p className="text-white/60 text-lg">Touch the screen to take your photo</p>
            </motion.div>
          </motion.div>

          {/* Mode buttons */}
          {modes.length > 1 && (
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20" onClick={(e) => e.stopPropagation()}>
              {modes.slice(1).map((m) => (
                <button key={m.mode} onClick={() => handleStart(m.mode)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 backdrop-blur text-white text-sm font-semibold border border-white/20">
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
          )}

          {/* Gear icon */}
          <button
            onClick={(e) => { e.stopPropagation(); handleGearPress(); }}
            className="absolute bottom-6 left-6 z-20 p-3 rounded-xl bg-black/40 border border-white/10 text-white/30 hover:text-white/60 hover:bg-black/60 transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {showPinModal && <PinModal />}
          {showPanel && <OperatorPanel onClose={() => setShowPanel(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // ── Default idle screen ────────────────────────────────────────────────────
  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden cursor-pointer select-none"
        onClick={() => handleStart('single')}
      >
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at center, ${primaryColor}88 0%, transparent 70%)` }} />

        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-2 h-2 rounded-full"
            style={{ background: primaryColor, left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}

        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12 z-10">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={eventName} className="h-24 w-auto mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 glow-purple" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }}>
              <Camera className="w-12 h-12 text-white" />
            </div>
          )}
          <h1 className="text-5xl font-black text-white tracking-tight">{eventName}</h1>
          {event?.name && event.name !== eventName && <p className="text-white/50 text-xl mt-2">{event.name}</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="z-10 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <motion.button
            animate={{ scale: tapPrompt ? 1.03 : 0.98 }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
            onClick={() => handleStart('single')}
            className="w-full py-10 rounded-3xl text-white text-3xl font-bold btn-touch glow-purple"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
          >
            <Camera className="w-12 h-12 mx-auto mb-3" />
            TAP TO START
          </motion.button>

          {modes.length > 1 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {modes.slice(1).map((m) => (
                <motion.button key={m.mode} whileTap={{ scale: 0.93 }} onClick={() => handleStart(m.mode)}
                  className="py-5 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold flex flex-col items-center gap-2 hover:bg-white/15 transition-all duration-200 btn-touch">
                  {m.icon}<span className="text-sm">{m.label}</span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="absolute bottom-8 text-white/30 text-sm z-10">
          Powered by SnapBooth AI ✨
        </motion.p>

        {/* Gear icon */}
        <button
          onClick={(e) => { e.stopPropagation(); handleGearPress(); }}
          className="absolute bottom-6 left-6 z-10 p-3 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-white/50 hover:bg-white/10 transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showPinModal && <PinModal />}
        {showPanel && <OperatorPanel onClose={() => setShowPanel(false)} />}
      </AnimatePresence>
    </>
  );
}
