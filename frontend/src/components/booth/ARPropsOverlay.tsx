'use client';

/**
 * ARPropsOverlay.tsx
 * High-performance digital prop & sticker engine for SnapBooth.
 * Renders interactive party props (sunglasses, crowns, hats, mustaches) over the camera preview
 * and composites them seamlessly onto the final captured canvas.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Crown, Glasses, Smile, Check } from 'lucide-react';

export interface PropItem {
  id: string;
  name: string;
  category: 'eyewear' | 'headwear' | 'fun';
  icon: string;
  // Relative placement defaults (0-100% of viewport)
  defaultX: number;
  defaultY: number;
  defaultScale: number;
  svg: string;
}

export const PROP_CATALOG: PropItem[] = [
  // Eyewear
  {
    id: 'aviators',
    name: 'Aviator Shades',
    category: 'eyewear',
    icon: '🕶️',
    defaultX: 50,
    defaultY: 42,
    defaultScale: 1.0,
    svg: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lens" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e1e24" stop-opacity="0.95"/>
          <stop offset="50%" stop-color="#3b3b4f" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#111116" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <path d="M20,25 Q60,18 95,28 Q100,30 105,28 Q140,18 180,25 Q190,45 170,68 Q140,78 110,65 Q98,58 95,35 Q90,35 87,58 Q60,78 30,68 Q10,45 20,25 Z" fill="none" stroke="#d4af37" stroke-width="4"/>
      <path d="M24,28 Q58,22 88,32 Q82,58 55,68 Q30,62 24,28 Z" fill="url(#lens)" stroke="#b89728" stroke-width="2"/>
      <path d="M112,32 Q142,22 176,28 Q170,62 145,68 Q118,58 112,32 Z" fill="url(#lens)" stroke="#b89728" stroke-width="2"/>
      <line x1="88" y1="30" x2="112" y2="30" stroke="#d4af37" stroke-width="3"/>
    </svg>`,
  },
  {
    id: 'heart_shades',
    name: 'Heart Shades',
    category: 'eyewear',
    icon: '💖',
    defaultX: 50,
    defaultY: 42,
    defaultScale: 1.1,
    svg: `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
      <path d="M55,20 C35,-5 0,10 0,45 C0,75 55,90 55,90 C55,90 110,75 110,45 C110,10 75,-5 55,20 Z" fill="#ec4899" opacity="0.9" stroke="#db2777" stroke-width="3"/>
      <path d="M165,20 C145,-5 110,10 110,45 C110,75 165,90 165,90 C165,90 220,75 220,45 C220,10 185,-5 165,20 Z" fill="#ec4899" opacity="0.9" stroke="#db2777" stroke-width="3"/>
      <line x1="102" y1="42" x2="118" y2="42" stroke="#db2777" stroke-width="4"/>
    </svg>`,
  },
  {
    id: 'retro_neon',
    name: 'Cyber Visor',
    category: 'eyewear',
    icon: '⚡',
    defaultX: 50,
    defaultY: 42,
    defaultScale: 1.15,
    svg: `<svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,10 210,10 195,50 25,50" fill="#06b6d4" opacity="0.85" stroke="#22d3ee" stroke-width="3"/>
      <line x1="15" y1="18" x2="205" y2="18" stroke="#ffffff" stroke-width="2" opacity="0.8"/>
      <line x1="20" y1="35" x2="200" y2="35" stroke="#ec4899" stroke-width="3" opacity="0.9"/>
    </svg>`,
  },

  // Headwear
  {
    id: 'royal_crown',
    name: 'Royal Crown',
    category: 'headwear',
    icon: '👑',
    defaultX: 50,
    defaultY: 20,
    defaultScale: 1.25,
    svg: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,110 30,30 70,80 100,20 130,80 170,30 190,110" fill="#facc15" stroke="#eab308" stroke-width="4"/>
      <circle cx="30" cy="25" r="7" fill="#ef4444"/>
      <circle cx="100" cy="15" r="9" fill="#3b82f6"/>
      <circle cx="170" cy="25" r="7" fill="#ef4444"/>
      <rect x="15" y="100" width="170" height="15" rx="3" fill="#ca8a04"/>
      <circle cx="50" cy="107" r="4" fill="#ffffff"/>
      <circle cx="100" cy="107" r="4" fill="#ffffff"/>
      <circle cx="150" cy="107" r="4" fill="#ffffff"/>
    </svg>`,
  },
  {
    id: 'party_hat',
    name: 'Party Cone',
    category: 'headwear',
    icon: '🎉',
    defaultX: 50,
    defaultY: 18,
    defaultScale: 1.1,
    svg: `<svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <polygon points="70,20 15,150 125,150" fill="#8b5cf6" stroke="#7c3aed" stroke-width="3"/>
      <circle cx="70" cy="18" r="12" fill="#fbbf24"/>
      <line x1="35" y1="100" x2="105" y2="100" stroke="#f43f5e" stroke-width="6"/>
      <line x1="45" y1="70" x2="95" y2="70" stroke="#10b981" stroke-width="5"/>
      <line x1="55" y1="45" x2="85" y2="45" stroke="#38bdf8" stroke-width="4"/>
    </svg>`,
  },
  {
    id: 'flower_crown',
    name: 'Floral Halo',
    category: 'headwear',
    icon: '🌸',
    defaultX: 50,
    defaultY: 22,
    defaultScale: 1.3,
    svg: `<svg viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,60 Q120,20 220,60" fill="none" stroke="#15803d" stroke-width="4"/>
      <circle cx="40" cy="55" r="14" fill="#f472b6"/>
      <circle cx="80" cy="40" r="16" fill="#fb7185"/>
      <circle cx="120" cy="35" r="18" fill="#fda4af"/>
      <circle cx="160" cy="40" r="16" fill="#fb7185"/>
      <circle cx="200" cy="55" r="14" fill="#f472b6"/>
      <circle cx="120" cy="35" r="7" fill="#fef08a"/>
    </svg>`,
  },

  // Fun & Party
  {
    id: 'mustache',
    name: 'Gentleman Mustache',
    category: 'fun',
    icon: '🥸',
    defaultX: 50,
    defaultY: 60,
    defaultScale: 0.95,
    svg: `<svg viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg">
      <path d="M80,30 C65,15 40,15 15,35 C0,48 5,55 20,50 C45,40 65,45 80,55 C95,45 115,40 140,50 C155,55 160,48 145,35 C120,15 95,15 80,30 Z" fill="#18181b" stroke="#09090b" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'sparkles',
    name: 'Celebration Sparkles',
    category: 'fun',
    icon: '✨',
    defaultX: 50,
    defaultY: 30,
    defaultScale: 1.2,
    svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M40,20 Q50,40 70,50 Q50,60 40,80 Q30,60 10,50 Q30,40 40,20 Z" fill="#fbbf24"/>
      <path d="M160,10 Q168,26 184,34 Q168,42 160,58 Q152,42 136,34 Q152,26 160,10 Z" fill="#a855f7"/>
      <path d="M110,50 Q115,62 127,68 Q115,74 110,86 Q105,74 93,68 Q105,62 110,50 Z" fill="#38bdf8"/>
    </svg>`,
  },
];

interface ARPropsOverlayProps {
  activePropId: string | null;
  onSelectProp: (id: string | null) => void;
  className?: string;
}

export function ARPropsOverlay({
  activePropId,
  onSelectProp,
  className = '',
}: ARPropsOverlayProps) {
  const activeProp = PROP_CATALOG.find((p) => p.id === activePropId);
  const [category, setCategory] = useState<'all' | 'eyewear' | 'headwear' | 'fun'>('all');

  const filtered = category === 'all'
    ? PROP_CATALOG
    : PROP_CATALOG.filter((p) => p.category === category);

  return (
    <div className={`pointer-events-none absolute inset-0 z-20 ${className}`}>
      {/* ── Active Live Prop Rendered on Viewfinder (Separated Layout & Motion transforms) ── */}
      <AnimatePresence>
        {activeProp && (
          <div
            key={activeProp.id}
            className="absolute pointer-events-auto cursor-move select-none"
            style={{
              left: `${activeProp.defaultX}%`,
              top: `${activeProp.defaultY}%`,
              transform: 'translate(-50%, -50%)',
              width: '42vw',
              maxWidth: '320px',
            }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: activeProp.defaultScale, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 340 }}
              className="w-full h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]"
              dangerouslySetInnerHTML={{ __html: activeProp.svg }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Interactive Prop Dock at Bottom ── */}
      <div className="pointer-events-auto absolute bottom-4 inset-x-0 flex flex-col items-center gap-2 px-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg text-xs">
          {[
            { id: 'all', label: 'All Props' },
            { id: 'eyewear', label: 'Shades' },
            { id: 'headwear', label: 'Hats & Crowns' },
            { id: 'fun', label: 'Party FX' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id as any)}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                category === cat.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
          {activePropId && (
            <button
              onClick={() => onSelectProp(null)}
              className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 font-bold transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Scrollable Horizontal Prop Tray */}
        <div className="flex items-center gap-2.5 overflow-x-auto max-w-full px-2 py-1 scrollbar-none">
          {filtered.map((prop) => {
            const isSelected = activePropId === prop.id;
            return (
              <button
                key={prop.id}
                onClick={() => onSelectProp(isSelected ? null : prop.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all active:scale-95 flex-shrink-0 shadow-lg ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-purple-500/30 scale-105'
                    : 'bg-black/70 backdrop-blur-xl border-white/15 text-white/80 hover:bg-black/90'
                }`}
              >
                <span className="text-xl">{prop.icon}</span>
                <span className="text-xs font-bold whitespace-nowrap">{prop.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ARPropsOverlay;
