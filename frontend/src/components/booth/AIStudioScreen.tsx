'use client';

/**
 * AIStudioScreen — Style picker shown BEFORE the photo is taken
 * Flow: Idle (AI Art button) → AIStudioScreen → Countdown → AIResultScreen → Share
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Shuffle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';

// Style definitions with visual gradient previews
const AI_STYLES = [
  {
    key: 'anime',
    name: 'Anime Art',
    emoji: '🎌',
    desc: 'Studio Ghibli style',
    gradient: 'linear-gradient(135deg, #ff6b9d, #c44dff)',
    example: '🌸',
    bgColor: '#1a0a2e',
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk',
    emoji: '🌆',
    desc: 'Neon city vibes',
    gradient: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
    example: '⚡',
    bgColor: '#0a1628',
  },
  {
    key: 'vintage',
    name: 'Vintage Film',
    emoji: '📷',
    desc: 'Kodachrome warmth',
    gradient: 'linear-gradient(135deg, #f7b733, #fc4a1a)',
    example: '🎞️',
    bgColor: '#1a0f00',
  },
  {
    key: 'watercolor',
    name: 'Watercolor',
    emoji: '🎨',
    desc: 'Soft painted look',
    gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    example: '🖌️',
    bgColor: '#001a14',
  },
  {
    key: 'oilpainting',
    name: 'Oil Painting',
    emoji: '🖼️',
    desc: 'Rembrandt style',
    gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
    example: '🏛️',
    bgColor: '#1a0010',
  },
  {
    key: 'comic',
    name: 'Comic Book',
    emoji: '💥',
    desc: 'Marvel / DC style',
    gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    example: '🦸',
    bgColor: '#00101a',
  },
];

export function AIStudioScreen() {
  const { setScreen, setMode, setSelectedAIStyle } = useBoothStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  function handleSelect(styleKey: string) {
    setSelected(styleKey);
  }

  function handleStart() {
    if (!selected) return;
    setSelectedAIStyle(selected);
    setMode('aistudio');
    setScreen('countdown');
  }

  function handleSurprise() {
    const random = AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
    setSelectedAIStyle(random.key);
    setMode('aistudio');
    setScreen('countdown');
  }

  const activeStyle = AI_STYLES.find(s => s.key === (hovered || selected));

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden select-none transition-colors duration-500"
      style={{ background: activeStyle ? activeStyle.bgColor : '#080810' }}
    >
      {/* Ambient glow based on selected style */}
      {activeStyle && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-500"
          style={{ background: `radial-gradient(ellipse at center, ${activeStyle.gradient.split(',')[1].trim().slice(0, -1)} 0%, transparent 60%)` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
        <button
          onClick={() => setScreen('idle')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-white font-bold text-base">AI Art Studio</h2>
        </div>
        <div className="w-16" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-5 py-4 overflow-y-auto">

        {/* Instruction */}
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white/50 text-sm text-center mb-5"
        >
          Pick your style — then we&apos;ll take your photo and transform it
        </motion.p>

        {/* Style grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {AI_STYLES.map((style, i) => {
            const isSelected = selected === style.key;
            return (
              <motion.button
                key={style.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(style.key)}
                onMouseEnter={() => setHovered(style.key)}
                onMouseLeave={() => setHovered(null)}
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden"
                style={{
                  borderColor: isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)',
                  background: isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  boxShadow: isSelected ? `0 0 30px rgba(255,255,255,0.15)` : 'none',
                }}
              >
                {/* Gradient background bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ background: style.gradient }}
                />

                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white flex items-center justify-center"
                  >
                    <span className="text-[10px] text-black font-black">✓</span>
                  </motion.div>
                )}

                {/* Style preview */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {style.emoji}
                </div>

                <div className="text-center">
                  <p className="text-white font-bold text-sm leading-tight">{style.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{style.desc}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Surprise Me */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSurprise}
          className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 mb-3"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          <Shuffle className="w-5 h-5" />
          🎲 Surprise Me
        </motion.button>
      </div>

      {/* Bottom CTA — sticky */}
      <div className="relative z-10 px-5 pb-6 pt-3 border-t border-white/[0.06]">
        <AnimatePresence>
          {selected ? (
            <motion.button
              key="start"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3"
              style={{
                background: activeStyle?.gradient || 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: '0 0 40px rgba(124,58,237,0.4)',
              }}
            >
              <Sparkles className="w-5 h-5" />
              {AI_STYLES.find(s => s.key === selected)?.emoji} Create {AI_STYLES.find(s => s.key === selected)?.name}
            </motion.button>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-white/25 text-sm py-4"
            >
              👆 Pick a style to continue
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
