'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function BackgroundSelector({ event, onBackgroundSelect, isLoading }: any) {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [useBlur, setUseBlur] = useState(false);
  const [blurAmount, setBlurAmount] = useState(50);
  const [loadingBg, setLoadingBg] = useState(false);

  // Pre-loaded background options
  const defaultBackgrounds = [
    { id: 'none', name: 'Original', type: 'original', url: null },
    { id: 'blur', name: 'Blur', type: 'blur', url: null },
    { id: 'beach', name: 'Beach', type: 'image', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600' },
    { id: 'forest', name: 'Forest', type: 'image', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600' },
    { id: 'city', name: 'City', type: 'image', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600' },
    { id: 'space', name: 'Space', type: 'image', url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=600' },
    { id: 'sunset', name: 'Sunset', type: 'image', url: 'https://images.unsplash.com/photo-1495568720989-cebdbdd97913?w=600' },
    { id: 'mountains', name: 'Mountains', type: 'image', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600' },
  ];

  useEffect(() => {
    // Load custom backgrounds from event if available
    if (event?.id) {
      loadBackgrounds();
    } else {
      setBackgrounds(defaultBackgrounds);
    }
  }, [event?.id]);

  async function loadBackgrounds() {
    try {
      const response = await fetch(`${API_BASE}/api/events/${event.id}/backgrounds`);
      if (response.ok) {
        const data = await response.json();
        setBackgrounds([...defaultBackgrounds, ...(data.backgrounds || [])]);
      } else {
        setBackgrounds(defaultBackgrounds);
      }
    } catch (error) {
      console.warn('Failed to load backgrounds:', error);
      setBackgrounds(defaultBackgrounds);
    }
  }

  function handleBackgroundSelect(bgId: string) {
    if (bgId === 'blur') {
      setUseBlur(true);
      setSelectedBg(null);
      onBackgroundSelect({ type: 'blur', blurAmount });
    } else {
      setUseBlur(false);
      setSelectedBg(bgId);
      const bg = backgrounds.find(b => b.id === bgId);
      onBackgroundSelect({ type: 'image', background: bg?.url || null });
    }
  }

  return (
    <div className="bg-[#0d0d1a]/80 backdrop-blur-xl border-t border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-300" />
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
            Virtual Backgrounds
          </span>
        </div>
      </div>

      {/* Background Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {backgrounds.map(bg => (
          <motion.button
            key={bg.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleBackgroundSelect(bg.id)}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
              selectedBg === bg.id || (useBlur && bg.id === 'blur')
                ? 'border-violet-400 ring-2 ring-violet-500'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            {bg.url ? (
              <img
                src={bg.url}
                alt={bg.name}
                className="w-full h-full object-cover"
              />
            ) : bg.id === 'blur' ? (
              <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
                <span className="text-white/50 text-xs">Blur</span>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <span className="text-white/50 text-xs">Original</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
            <span className="absolute bottom-1 left-1 right-1 text-white text-xs font-semibold bg-black/50 px-2 py-0.5 rounded truncate">
              {bg.name}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Blur Amount Slider */}
      {useBlur && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-3 bg-white/5 rounded-lg"
        >
          <label className="flex items-center justify-between text-white text-sm mb-2">
            Blur Amount
            <span className="text-violet-300 font-bold">{blurAmount}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={blurAmount}
            onChange={e => {
              const value = Number(e.target.value);
              setBlurAmount(value);
              onBackgroundSelect({ type: 'blur', blurAmount: value });
            }}
            className="w-full accent-violet-500"
          />
        </motion.div>
      )}

      {isLoading && (
        <div className="text-center text-white/50 text-sm py-2">
          Processing background...
        </div>
      )}
    </div>
  );
}
