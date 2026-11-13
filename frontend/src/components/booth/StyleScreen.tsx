'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, Sparkles, Film, Zap, ArrowLeft, ChevronRight } from 'lucide-react';
import { useBoothStore, BoothMode } from '@/lib/store';

export function StyleScreen() {
  const { event, setScreen, setMode } = useBoothStore();

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';
  const themeMode = (branding?.themeMode as string) || 'light';
  const isLight = themeMode === 'light';

  const handleSelectMode = (mode: BoothMode) => {
    setMode(mode);
    setScreen('countdown');
  };

  const formats: Array<{
    mode: BoothMode;
    title: string;
    badge: string;
    subtitle: string;
    previewUrl: string;
    icon: React.ReactNode;
    enabled: boolean;
  }> = [
    {
      mode: 'single',
      title: 'Studio Portrait',
      badge: 'High-Res 4K',
      subtitle: 'Single studio shot with beauty lighting',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      icon: <Camera className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'strip',
      title: 'Retro 4-Strip',
      badge: 'Classic Keepsake',
      subtitle: '4 rapid poses in a classic vertical strip',
      previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&h=200&q=80',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'aistudio',
      title: 'AI Studio Art',
      badge: 'Neural Magic',
      subtitle: 'Transform into themed artistic portraits',
      previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80',
      icon: <Sparkles className="w-5 h-5 text-white" />,
      enabled: settings?.allowAI !== false,
    },
    {
      mode: 'gif',
      title: 'Animated GIF',
      badge: 'Burst Motion',
      subtitle: 'Animated burst mini loop for social sharing',
      previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80',
      icon: <Film className="w-5 h-5 text-white" />,
      enabled: settings?.allowGIF === true,
    },
    {
      mode: 'boomerang',
      title: 'Boomerang',
      badge: 'Infinite Loop',
      subtitle: 'Back-and-forth dynamic video loop',
      previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&h=200&q=80',
      icon: <Zap className="w-5 h-5 text-white" />,
      enabled: settings?.allowBoomerang === true,
    },
  ];

  const enabledFormats = formats.filter(f => f.enabled);

  return (
    <div className="w-full h-full flex flex-col p-6 sm:p-10 select-none relative z-10 overflow-hidden">
      {/* Top Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between flex-shrink-0 z-20 mb-6 sm:mb-8">
        <button
          onClick={() => setScreen('idle')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${
            isLight
              ? 'bg-black/5 hover:bg-black/10 text-slate-700'
              : 'bg-white/10 hover:bg-white/15 text-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="text-center">
          <span className={`text-[10px] font-extrabold uppercase tracking-[0.25em] block ${
            isLight ? 'text-purple-600' : 'text-purple-400'
          }`}>
            Choose Your Style
          </span>
          <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            What are we creating?
          </h2>
        </div>

        <div className="w-20" />
      </div>

      {/* Compact Row Cards */}
      <div className="flex-1 flex flex-col justify-center w-full max-w-2xl mx-auto gap-3 min-h-0">
        {enabledFormats.map((item, idx) => (
          <motion.button
            key={item.mode}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.35 }}
            whileHover={{ scale: 1.015, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelectMode(item.mode)}
            className={`group relative flex items-center gap-4 w-full rounded-2xl overflow-hidden text-left cursor-pointer transition-all duration-200 shadow-lg border ${
              isLight
                ? 'bg-white/70 hover:bg-white/90 border-black/8 hover:border-purple-400/60 hover:shadow-purple-200/60 hover:shadow-xl backdrop-blur-sm'
                : 'bg-white/8 hover:bg-white/14 border-white/12 hover:border-purple-400/60 hover:shadow-purple-900/40 hover:shadow-xl backdrop-blur-sm'
            } h-[72px] sm:h-[80px] px-4 sm:px-5`}
          >
            {/* Thumbnail */}
            <div className="relative flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
              />
              {/* Icon overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ backgroundColor: `${primaryColor}cc` }}
              >
                {item.icon}
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-base sm:text-lg font-black tracking-tight truncate ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  {item.title}
                </span>
                <span
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white"
                  style={{ backgroundColor: `${primaryColor}99` }}
                >
                  {item.badge}
                </span>
              </div>
              <p className={`text-xs sm:text-sm font-medium leading-snug truncate ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {item.subtitle}
              </p>
            </div>

            {/* Icon indicator */}
            <div
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{ backgroundColor: `${primaryColor}22` }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
                style={{ backgroundColor: `${primaryColor}` }}
              >
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="w-full text-center pt-5 flex-shrink-0 z-20">
        <p className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Tap a style to begin your session
        </p>
      </div>
    </div>
  );
}
