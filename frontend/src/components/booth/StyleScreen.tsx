'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, Sparkles, Film, Zap, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      icon: <Camera className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'strip',
      title: 'Retro 4-Strip',
      badge: 'Classic Keepsake',
      subtitle: '4 rapid poses in a classic vertical strip',
      previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'aistudio',
      title: 'AI Studio Art',
      badge: 'Neural Magic',
      subtitle: 'Transform into themed artistic portraits',
      previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
      icon: <Sparkles className="w-5 h-5 text-white" />,
      enabled: settings?.allowAI !== false,
    },
    {
      mode: 'gif',
      title: 'Animated GIF',
      badge: 'Burst Motion',
      subtitle: 'Animated burst mini loop for social sharing',
      previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
      icon: <Film className="w-5 h-5 text-white" />,
      enabled: settings?.allowGIF === true,
    },
    {
      mode: 'boomerang',
      title: 'Boomerang',
      badge: 'Infinite Loop',
      subtitle: 'Back-and-forth dynamic video loop',
      previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
      icon: <Zap className="w-5 h-5 text-white" />,
      enabled: settings?.allowBoomerang === true,
    },
  ];

  const enabledFormats = formats.filter(f => f.enabled);

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 sm:p-10 select-none relative z-10 overflow-hidden">
      {/* Top Header */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between flex-shrink-0 z-20">
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
            Format Selection
          </span>
          <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Choose Your Experience
          </h2>
        </div>

        <div className="w-20" />
      </div>

      {/* Main Visual Format Cards Grid */}
      <div className="flex-1 flex items-center justify-center my-4 min-h-0 w-full max-w-6xl mx-auto">
        <div
          className={`grid gap-5 sm:gap-6 w-full ${
            enabledFormats.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl'
              : enabledFormats.length === 3
              ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl'
              : 'grid-cols-2 sm:grid-cols-4 max-w-6xl'
          }`}
        >
          {enabledFormats.map((item, idx) => (
            <motion.button
              key={item.mode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleSelectMode(item.mode)}
              className="group relative flex flex-col rounded-[28px] sm:rounded-[32px] overflow-hidden text-left cursor-pointer transition-all duration-300 shadow-2xl border-2 border-white/20 dark:border-white/10 hover:border-purple-500/80 aspect-[3/4] max-h-[58vh]"
            >
              {/* Background Photographic Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Multi-layer Vignette & Scrim Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

              {/* Top Tag & Icon */}
              <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between w-full">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-md border border-white/20">
                  {item.badge}
                </span>

                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md"
                  style={{ backgroundColor: `${primaryColor}cc` }}
                >
                  {item.icon}
                </div>
              </div>

              {/* Bottom Details with Clear Editorial Typography */}
              <div className="relative z-10 mt-auto p-5 sm:p-6 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md group-hover:text-purple-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-white/80 text-xs sm:text-sm font-medium leading-snug drop-shadow-sm">
                  {item.subtitle}
                </p>

                <div className="pt-2 flex items-center gap-1.5 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Step inside</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="w-full text-center pb-2 flex-shrink-0 z-20">
        <p className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Touch any card to begin the studio countdown
        </p>
      </div>
    </div>
  );
}
