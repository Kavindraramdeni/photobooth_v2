'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, Sparkles, Film, Zap, ArrowLeft } from 'lucide-react';
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
      subtitle: 'Single studio shot',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      icon: <Camera className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'strip',
      title: 'Retro 4-Strip',
      badge: 'Classic 4-Shot',
      subtitle: '4 rapid poses in a strip',
      previewUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
      enabled: true,
    },
    {
      mode: 'aistudio',
      title: 'AI Studio Art',
      badge: 'Neural Magic',
      subtitle: 'Artistic transformed portraits',
      previewUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
      icon: <Sparkles className="w-5 h-5 text-white" />,
      enabled: settings?.allowAI !== false,
    },
    {
      mode: 'gif',
      title: 'Animated GIF',
      badge: 'Burst Motion',
      subtitle: 'Animated burst mini loop',
      previewUrl: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
      icon: <Film className="w-5 h-5 text-white" />,
      enabled: settings?.allowGIF === true,
    },
    {
      mode: 'boomerang',
      title: 'Boomerang',
      badge: 'Infinite Loop',
      subtitle: 'Back-and-forth motion video',
      previewUrl: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
      icon: <Zap className="w-5 h-5 text-white" />,
      enabled: settings?.allowBoomerang === true,
    },
  ];

  const enabledFormats = formats.filter(f => f.enabled);
  const count = enabledFormats.length;

  /**
   * Grid columns:
   *  - mobile  (<640px):  2 cols always (small cards, may wrap to 2 rows — fine on phone)
   *  - tablet  (640–1023): min(count, 3) cols so ≤3 per row
   *  - desktop (≥1024px):  all cards in a single row (up to 5)
   *
   * Card height shrinks as count grows so everything stays on-screen on larger displays.
   */
  const gridColsClass =
    count <= 2
      ? 'grid-cols-2'
      : count === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : count === 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : /* 5 */ 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  /**
   * Card height — portrait style, but shorter as the grid gets wider.
   * On desktop all 5 fit at ~h-52 (208px); on tablet 3 at a time at h-60; on mobile 2-col at h-52.
   */
  const cardHeightClass =
    count <= 2
      ? 'h-72 sm:h-80 lg:h-96'
      : count === 3
      ? 'h-60 sm:h-72 lg:h-80'
      : count === 4
      ? 'h-56 sm:h-64 lg:h-72'
      : /* 5 */ 'h-52 sm:h-56 lg:h-60';

  return (
    <div className="w-full h-full flex flex-col p-5 sm:p-8 lg:p-10 select-none relative z-10 overflow-hidden">

      {/* Header */}
      <div className="w-full flex items-center justify-between flex-shrink-0 z-20 mb-5 sm:mb-6">
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
          <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.25em] block ${
            isLight ? 'text-purple-600' : 'text-purple-400'
          }`}>
            Choose Your Style
          </span>
          <h2 className={`text-lg sm:text-2xl lg:text-3xl font-black tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            What are we creating?
          </h2>
        </div>

        <div className="w-20" />
      </div>

      {/* Portrait Cards Grid */}
      <div className="flex-1 flex items-center justify-center min-h-0 w-full">
        <div className={`grid ${gridColsClass} gap-3 sm:gap-4 lg:gap-5 w-full`}>
          {enabledFormats.map((item, idx) => (
            <motion.button
              key={item.mode}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.4, ease: 'easeOut' }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectMode(item.mode)}
              className={`group relative flex flex-col rounded-2xl sm:rounded-[24px] overflow-hidden text-left cursor-pointer transition-all duration-300 shadow-xl border-2 border-transparent hover:border-purple-500/70 ${cardHeightClass}`}
            >
              {/* Full-bleed background photo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Gradient scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

              {/* Hover glow overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{ background: `linear-gradient(to top, ${primaryColor}, transparent)` }}
              />

              {/* Top — badge + icon */}
              <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between w-full">
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider bg-black/50 text-white backdrop-blur-md border border-white/20 leading-tight">
                  {item.badge}
                </span>
                <div
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-md"
                  style={{ backgroundColor: `${primaryColor}cc` }}
                >
                  <span className="scale-75 sm:scale-100">{item.icon}</span>
                </div>
              </div>

              {/* Bottom — title + subtitle */}
              <div className="relative z-10 mt-auto p-3 sm:p-4 lg:p-5 space-y-0.5">
                <h3 className="text-sm sm:text-lg lg:text-xl font-black text-white tracking-tight leading-tight drop-shadow-md group-hover:text-purple-300 transition-colors line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-white/70 text-[10px] sm:text-xs font-medium leading-snug line-clamp-1">
                  {item.subtitle}
                </p>

                {/* Tap cue — desktop hover only */}
                <div className="hidden sm:flex items-center gap-1 pt-1 text-white/0 group-hover:text-white/90 text-[10px] font-bold transition-colors duration-200">
                  <span>Select</span>
                  <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="w-full text-center pt-4 flex-shrink-0 z-20">
        <p className={`text-[10px] sm:text-xs font-bold tracking-wide ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}>
          Tap a style to begin your session
        </p>
      </div>
    </div>
  );
}
