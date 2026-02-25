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

  const modes = [
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
  ] satisfies {
    mode: BoothMode;
    label: string;
    icon: React.ReactNode;
    enabled: boolean;
  }[];

  const enabledModes = modes.filter((m) => m.enabled);

  function handleStart(mode: BoothMode) {
    setMode(mode);
    setScreen('countdown');
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden">

      {/* Background Glow */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}88 0%, transparent 70%)`,
        }}
      />

      {/* Logo / Event Name */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 z-10"
      >
        <h1 className="text-5xl font-black text-white tracking-tight">
          {eventName}
        </h1>

        {event?.name && event.name !== eventName && (
          <p className="text-white/50 text-xl mt-2">{event.name}</p>
        )}
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="z-10 w-full max-w-lg"
      >
        {enabledModes.length === 1 ? (
          <button
            onClick={() => handleStart(enabledModes[0].mode)}
            className="w-full py-10 rounded-3xl text-white text-3xl font-bold
                       transition-all duration-200 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
            }}
          >
            Tap to Start
          </button>
        ) : (
          <>
            {/* Primary Photo Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStart('single')}
              className="w-full py-8 rounded-3xl text-white text-2xl font-bold mb-6
                         transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
              }}
            >
              <Camera className="w-10 h-10 mx-auto mb-2" />
              Tap to Take a Photo
            </motion.button>

            {/* Other Modes */}
            <div className="grid grid-cols-3 gap-3">
              {enabledModes
                .filter((m) => m.mode !== 'single')
                .map((m) => (
                  <motion.button
                    key={m.mode}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStart(m.mode)}
                    className="py-5 rounded-2xl bg-white/10 border border-white/20
                               text-white font-semibold flex flex-col items-center gap-2
                               hover:bg-white/15 transition-all duration-200"
                  >
                    {m.icon}
                    <span className="text-sm">{m.label}</span>
                  </motion.button>
                ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Footer */}
      <p className="absolute bottom-8 text-white/30 text-sm z-10">
        Powered by SnapBooth AI ✨
      </p>
    </div>
  );
}