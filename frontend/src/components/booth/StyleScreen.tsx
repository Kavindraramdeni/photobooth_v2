'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, Sparkles, Film, Zap, ArrowLeft } from 'lucide-react';
import { useBoothStore, BoothMode } from '@/lib/store';

export function StyleScreen() {
  const { event, setScreen, setMode } = useBoothStore();

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#6366f1';
  const themeMode = (branding?.themeMode as string) || 'dark';
  const isLight = themeMode === 'light';

  const handleSelectMode = (mode: BoothMode) => {
    setMode(mode);
    if (mode === 'aistudio') {
      setScreen('aistudio');
    } else {
      setScreen('countdown');
    }
  };

  const modes: Array<{
    mode: BoothMode;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    enabled: boolean;
  }> = [
    {
      mode: 'single',
      label: 'Photo',
      subtitle: 'Single high-resolution portrait',
      icon: <Camera className="w-12 h-12" />,
      enabled: true,
    },
    {
      mode: 'strip',
      label: 'Strip',
      subtitle: 'Retro 4-pose print strip',
      icon: <ImageIcon className="w-12 h-12" />,
      enabled: true,
    },
    {
      mode: 'aistudio',
      label: 'AI Studio',
      subtitle: 'Instant themed art transformation',
      icon: <Sparkles className="w-12 h-12" />,
      enabled: settings?.allowAI !== false,
    },
    {
      mode: 'gif',
      label: 'GIF',
      subtitle: 'Animated burst mini loop',
      icon: <Film className="w-12 h-12" />,
      enabled: settings?.allowGIF === true,
    },
    {
      mode: 'boomerang',
      label: 'Boomerang',
      subtitle: 'Back-and-forth moving motion',
      icon: <Zap className="w-12 h-12" />,
      enabled: settings?.allowBoomerang === true,
    },
  ];

  const enabledModes = modes.filter(m => m.enabled);

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 sm:p-12 select-none relative z-10">
      {/* Header: Short, Bold, Punchy */}
      <div className="text-center pt-4 sm:pt-8 flex-shrink-0">
        <h1
          className={`text-4xl sm:text-6xl font-black tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          Choose your style
        </h1>
        <p
          className={`mt-2 text-lg sm:text-xl font-semibold ${
            isLight ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          Tap an option to step up and pose
        </p>
      </div>

      {/* Main Grid: 3 Large Solid Opaque Tiles (or up to 5) */}
      <div className="flex-1 flex items-center justify-center my-6">
        <div
          className={`grid gap-6 w-full max-w-5xl ${
            enabledModes.length <= 3
              ? 'grid-cols-1 md:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {enabledModes.map((item) => (
            <motion.button
              key={item.mode}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectMode(item.mode)}
              className={`flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-3xl transition-all duration-200 shadow-xl cursor-pointer border-2 ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-slate-200/50'
                  : 'bg-[#181938] hover:bg-[#202248] border-slate-700/60 text-white shadow-black/40'
              }`}
            >
              {/* Single Accent Icon */}
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 shadow-md"
                style={{
                  backgroundColor: isLight ? `${primaryColor}15` : `${primaryColor}28`,
                  color: primaryColor,
                }}
              >
                {item.icon}
              </div>

              {/* 32px Label */}
              <span className="text-[32px] font-black tracking-tight leading-tight">
                {item.label}
              </span>

              {/* 20px+ Subtitle */}
              <span
                className={`text-[20px] font-semibold mt-3 leading-snug ${
                  isLight ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {item.subtitle}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Bar: Small Back Button */}
      <div className="flex justify-center pb-4 flex-shrink-0">
        <button
          onClick={() => setScreen('idle')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold tracking-wide transition-all duration-150 active:scale-95 ${
            isLight
              ? 'bg-slate-200/90 text-slate-700 hover:bg-slate-300'
              : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Start</span>
        </button>
      </div>
    </div>
  );
}
