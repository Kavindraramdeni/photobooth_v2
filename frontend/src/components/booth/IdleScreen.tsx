'use client';

import { motion } from 'framer-motion';
import { Camera, Zap, Film, Image } from 'lucide-react';
import { useBoothStore, BoothMode } from '@/lib/store';

export function IdleScreen() {
  const { event, setScreen, setMode } = useBoothStore();

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = branding?.primaryColor || '#7c3aed';
  const eventName = branding?.eventName || 'SnapBooth AI';

  const modes: { mode: BoothMode; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    {
      mode: 'single',
      label: 'Photo',
      icon: <Camera className="w-7 h-7" />,
      enabled: true,
    },
    {
      mode: 'strip',
      label: '4-Strip',
      icon: <Image className="w-7 h-7" />,
      enabled: true,
    },
    {
      mode: 'gif',
      label: 'GIF',
      icon: <Film className="w-7 h-7" />,
      enabled: settings?.allowGIF !== false,
    },
    {
      mode: 'boomerang',
      label: 'Boomerang',
      icon: <Zap className="w-7 h-7" />,
      enabled: settings?.allowBoomerang !== false,
    },
  ].filter((m) => m.enabled);

  function handleStart(mode: BoothMode) {
    setMode(mode);
    setScreen('countdown');
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}88 0%, transparent 70%)`,
        }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: primaryColor,
            left: `${15 + i * 14}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [-10, 10, -10],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
          }}
        />
      ))}

      {/* Logo / Event name */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 z-10"
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={eventName}
            className="h-24 w-auto mx-auto mb-4 object-contain"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 glow-purple"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }}
          >
            <Camera className="w-12 h-12 text-white" />
          </div>
        )}
        <h1 className="text-5xl font-black text-white tracking-tight">{eventName}</h1>
        {event?.name && event.name !== eventName && (
          <p className="text-white/50 text-xl mt-2">{event.name}</p>
        )}
      </motion.div>

      {/* Touch to start - big tap area */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="z-10 w-full max-w-lg"
      >
        {modes.length === 1 ? (
          // Single mode - just one big button
          <button
            onClick={() => handleStart(modes[0].mode)}
            className="w-full py-10 rounded-3xl text-white text-3xl font-bold btn-touch
                       transition-all duration-200 active:scale-95 glow-purple"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
          >
            <Camera className="w-12 h-12 mx-auto mb-3" />
            Tap to Start
          </button>
        ) : (
          <>
            {/* Primary start button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStart('single')}
              className="w-full py-8 rounded-3xl text-white text-2xl font-bold mb-6
                         transition-all duration-200 glow-purple"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
            >
              <Camera className="w-10 h-10 mx-auto mb-2" />
              Tap to Take a Photo
            </motion.button>

            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-3">
              {modes.slice(1).map((m) => (
                <motion.button
                  key={m.mode}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleStart(m.mode)}
                  className="py-5 rounded-2xl bg-white/10 border border-white/20
                             text-white font-semibold flex flex-col items-center gap-2
                             hover:bg-white/15 transition-all duration-200 btn-touch"
                >
                  {m.icon}
                  <span className="text-sm">{m.label}</span>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Bottom hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 text-white/30 text-sm z-10"
      >
        Powered by SnapBooth AI ✨
      </motion.p>
    </div>
  );
}
