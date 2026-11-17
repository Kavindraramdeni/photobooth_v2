'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Trash2,
  RotateCw,
  Maximize2,
  Check,
  Plus,
  Palette,
  Heart,
  Smile,
  Crown,
  Glasses,
  MessageSquare,
} from 'lucide-react';

export interface PropItem {
  id: string;
  name: string;
  category: 'wedding' | 'party' | 'bubbles' | 'fun';
  type: 'svg' | 'text';
  renderSvg?: string;
  text?: string;
  defaultScale: number;
}

export interface PlacedProp {
  instanceId: string;
  propId: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  rotation: number;
  renderSvg?: string;
  text?: string;
  category: string;
}

export const CURATED_PROPS: PropItem[] = [
  // 1. Royal & Wedding
  {
    id: 'prop-crown',
    name: 'Royal Crown',
    category: 'wedding',
    type: 'svg',
    defaultScale: 1.1,
    renderSvg: `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 70 L20 25 L40 50 L50 15 L60 50 L80 25 L90 70 Z" fill="url(#crownGrad)" stroke="#b45309" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="20" cy="22" r="5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
        <circle cx="50" cy="12" r="6" fill="#10b981" stroke="#fff" stroke-width="1.5"/>
        <circle cx="80" cy="22" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
        <circle cx="35" cy="62" r="3" fill="#fff" />
        <circle cx="50" cy="62" r="4" fill="#ef4444" />
        <circle cx="65" cy="62" r="3" fill="#fff" />
        <defs>
          <linearGradient id="crownGrad" x1="0" y1="0" x2="100" y2="80" gradientUnits="userSpaceOnUse">
            <stop stop-color="#fde047" />
            <stop offset="0.5" stop-color="#f59e0b" />
            <stop offset="1" stop-color="#b45309" />
          </linearGradient>
        </defs>
      </svg>
    `,
  },
  {
    id: 'prop-turban',
    name: 'Mughal Turban',
    category: 'wedding',
    type: 'svg',
    defaultScale: 1.3,
    renderSvg: `
      <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 75 Q15 45 40 30 Q60 15 85 25 Q105 40 100 75 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="2" />
        <path d="M25 65 Q60 55 95 65 Q90 80 60 82 Q30 80 25 65 Z" fill="#991b1b" />
        <path d="M60 15 Q65 5 70 0 Q65 10 60 20 Z" fill="#caa560" stroke="#f59e0b" stroke-width="1.5" />
        <circle cx="60" cy="28" r="7" fill="#10b981" stroke="#fde047" stroke-width="2" />
        <circle cx="60" cy="28" r="2.5" fill="#fff" />
      </svg>
    `,
  },
  {
    id: 'prop-garland',
    name: 'Flower Garland',
    category: 'wedding',
    type: 'svg',
    defaultScale: 1.4,
    renderSvg: `
      <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 10 C30 80 110 80 120 10" stroke="#f97316" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.85" />
        <path d="M25 15 C35 75 105 75 115 15" stroke="#facc15" stroke-width="9" stroke-linecap="round" fill="none" />
        <circle cx="70" cy="74" r="9" fill="#ef4444" stroke="#fef08a" stroke-width="2"/>
        <circle cx="50" cy="66" r="7" fill="#f97316"/>
        <circle cx="90" cy="66" r="7" fill="#f97316"/>
      </svg>
    `,
  },

  // 2. Party & Glasses
  {
    id: 'prop-sunglasses',
    name: 'Cool Shades',
    category: 'party',
    type: 'svg',
    defaultScale: 1.2,
    renderSvg: `
      <svg viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="45" height="30" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="3" />
        <rect x="65" y="10" width="45" height="30" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="3" />
        <line x1="55" y1="20" x2="65" y2="20" stroke="#3f3f46" stroke-width="4" />
        <path d="M15 15 L35 35" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M70 15 L90 35" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'prop-heart-glasses',
    name: 'Heart Glasses',
    category: 'party',
    type: 'svg',
    defaultScale: 1.25,
    renderSvg: `
      <svg viewBox="0 0 120 55" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 25 C10 12 30 12 35 25 C40 12 60 12 60 25 C60 40 35 50 35 50 C35 50 10 40 10 25 Z" fill="#ec4899" stroke="#db2777" stroke-width="2.5" />
        <path d="M60 25 C60 12 80 12 85 25 C90 12 110 12 110 25 C110 40 85 50 85 50 C85 50 60 40 60 25 Z" fill="#ec4899" stroke="#db2777" stroke-width="2.5" />
        <line x1="55" y1="25" x2="65" y2="25" stroke="#db2777" stroke-width="3.5" />
      </svg>
    `,
  },
  {
    id: 'prop-mustache',
    name: 'Gentleman Stache',
    category: 'party',
    type: 'svg',
    defaultScale: 1.1,
    renderSvg: `
      <svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 20 C40 5 15 5 5 25 C15 35 40 25 50 20 Z" fill="#1c1917" stroke="#292524" stroke-width="2"/>
        <path d="M50 20 C60 5 85 5 95 25 C85 35 60 25 50 20 Z" fill="#1c1917" stroke="#292524" stroke-width="2"/>
      </svg>
    `,
  },
  {
    id: 'prop-party-hat',
    name: 'Party Hat',
    category: 'party',
    type: 'svg',
    defaultScale: 1.2,
    renderSvg: `
      <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 85 L40 15 L65 85 Z" fill="url(#hatGrad)" stroke="#c026d3" stroke-width="2" />
        <circle cx="40" cy="12" r="7" fill="#fde047" />
        <circle cx="28" cy="45" r="4" fill="#38bdf8" />
        <circle cx="52" cy="55" r="4" fill="#f43f5e" />
        <circle cx="38" cy="72" r="5" fill="#fde047" />
        <defs>
          <linearGradient id="hatGrad" x1="15" y1="85" x2="65" y2="15" gradientUnits="userSpaceOnUse">
            <stop stop-color="#9333ea" />
            <stop offset="1" stop-color="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
    `,
  },

  // 3. Speech Bubbles & Signs
  {
    id: 'prop-just-married',
    name: 'Just Married Sign',
    category: 'bubbles',
    type: 'text',
    text: 'JUST MARRIED 💍',
    defaultScale: 1.2,
  },
  {
    id: 'prop-best-day',
    name: 'Best Day Ever',
    category: 'bubbles',
    type: 'text',
    text: 'BEST DAY EVER! ✨',
    defaultScale: 1.2,
  },
  {
    id: 'prop-squad-goals',
    name: 'Squad Goals',
    category: 'bubbles',
    type: 'text',
    text: 'SQUAD GOALS 🔥',
    defaultScale: 1.15,
  },
  {
    id: 'prop-vip-guest',
    name: 'VIP Guest',
    category: 'bubbles',
    type: 'text',
    text: '⭐ VIP GUEST ⭐',
    defaultScale: 1.1,
  },
  {
    id: 'prop-came-for-cake',
    name: 'Came for Cake',
    category: 'bubbles',
    type: 'text',
    text: 'Came for the Cake 🎂',
    defaultScale: 1.1,
  },

  // 4. Celebration & Sparkles
  {
    id: 'prop-sparkles',
    name: 'Golden Sparkles',
    category: 'fun',
    type: 'svg',
    defaultScale: 1.15,
    renderSvg: `
      <svg viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M45 5 L53 35 L83 45 L53 55 L45 85 L37 55 L7 45 L37 35 Z" fill="#fde047" stroke="#eab308" stroke-width="2"/>
        <path d="M20 20 L24 32 L36 36 L24 40 L20 52 L16 40 L4 36 L16 32 Z" fill="#fef08a" />
        <path d="M70 65 L73 73 L81 76 L73 79 L70 87 L67 79 L59 76 L67 73 Z" fill="#fef08a" />
      </svg>
    `,
  },
  {
    id: 'prop-red-heart',
    name: 'Red Heart',
    category: 'fun',
    type: 'svg',
    defaultScale: 1.1,
    renderSvg: `
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 70 C40 70 10 50 10 25 C10 12 25 8 35 18 C40 23 40 23 40 23 C40 23 40 23 45 18 C55 8 70 12 70 25 C70 50 40 70 40 70 Z" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
      </svg>
    `,
  },
];

interface DigitalPropsOverlayProps {
  containerWidth: number;
  containerHeight: number;
  placedProps: PlacedProp[];
  onPropsChange: (props: PlacedProp[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function DigitalPropsOverlay({
  containerWidth,
  containerHeight,
  placedProps,
  onPropsChange,
  isOpen,
  onClose,
}: DigitalPropsOverlayProps) {
  const [selectedPropInstanceId, setSelectedPropInstanceId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'wedding' | 'party' | 'bubbles' | 'fun'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProp = placedProps.find((p) => p.instanceId === selectedPropInstanceId);

  // Add prop to center of photo
  const handleAddProp = (prop: PropItem) => {
    const newProp: PlacedProp = {
      instanceId: `placed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      propId: prop.id,
      name: prop.name,
      x: 42 + (Math.random() * 16 - 8),
      y: 40 + (Math.random() * 16 - 8),
      scale: prop.defaultScale,
      rotation: 0,
      renderSvg: prop.renderSvg,
      text: prop.text,
      category: prop.category,
    };

    onPropsChange([...placedProps, newProp]);
    setSelectedPropInstanceId(newProp.instanceId);
  };

  // Delete prop
  const handleDeleteProp = (instanceId: string) => {
    onPropsChange(placedProps.filter((p) => p.instanceId !== instanceId));
    if (selectedPropInstanceId === instanceId) {
      setSelectedPropInstanceId(null);
    }
  };

  // Update scale
  const handleScaleChange = (delta: number) => {
    if (!selectedPropInstanceId) return;
    onPropsChange(
      placedProps.map((p) =>
        p.instanceId === selectedPropInstanceId
          ? { ...p, scale: Math.max(0.5, Math.min(2.8, p.scale + delta)) }
          : p
      )
    );
  };

  // Update rotation
  const handleRotate = () => {
    if (!selectedPropInstanceId) return;
    onPropsChange(
      placedProps.map((p) =>
        p.instanceId === selectedPropInstanceId
          ? { ...p, rotation: (p.rotation + 15) % 360 }
          : p
      )
    );
  };

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent, instanceId: string) => {
    e.stopPropagation();
    setSelectedPropInstanceId(instanceId);
    setIsDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const prop = placedProps.find((p) => p.instanceId === instanceId);
    if (!prop) return;

    const initialPropX = prop.x;
    const initialPropY = prop.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, initialPropX + deltaX));
      const newY = Math.max(5, Math.min(95, initialPropY + deltaY));

      onPropsChange(
        placedProps.map((p) => (p.instanceId === instanceId ? { ...p, x: newX, y: newY } : p))
      );
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const filteredCatalog =
    activeCategory === 'all'
      ? CURATED_PROPS
      : CURATED_PROPS.filter((p) => p.category === activeCategory);

  return (
    <>
      {/* ── Active Placed Props Layer (Directly over photo) ───────── */}
      <div
        ref={containerRef}
        onClick={() => setSelectedPropInstanceId(null)}
        className="absolute inset-0 z-20 pointer-events-auto select-none overflow-hidden"
      >
        {placedProps.map((prop) => {
          const isSelected = prop.instanceId === selectedPropInstanceId;

          return (
            <div
              key={prop.instanceId}
              onPointerDown={(e) => handlePointerDown(e, prop.instanceId)}
              style={{
                position: 'absolute',
                left: `${prop.x}%`,
                top: `${prop.y}%`,
                transform: `translate(-50%, -50%) rotate(${prop.rotation}deg) scale(${prop.scale})`,
                cursor: 'grab',
                touchAction: 'none',
              }}
              className="group select-none"
            >
              {/* Prop Content */}
              {prop.renderSvg ? (
                <div
                  className="w-24 h-24 flex items-center justify-center filter drop-shadow-lg"
                  dangerouslySetInnerHTML={{ __html: prop.renderSvg }}
                />
              ) : (
                <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-black text-sm tracking-wide shadow-2xl border-2 border-white/60 whitespace-nowrap">
                  {prop.text}
                </div>
              )}

              {/* Selection Box & Touch Handles */}
              {isSelected && (
                <div className="absolute -inset-2 border-2 border-dashed border-purple-400 rounded-2xl pointer-events-none">
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProp(prop.instanceId);
                    }}
                    className="absolute -top-3.5 -right-3.5 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Rotate Knob */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotate();
                    }}
                    className="absolute -top-3.5 -left-3.5 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto active:scale-90 transition-transform"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Scale Up / Down */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScaleChange(0.2);
                    }}
                    className="absolute -bottom-3.5 -right-3.5 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto active:scale-90 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Slide-Up Touch Props Drawer (Catalog) ────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#12142a]/95 backdrop-blur-2xl border-t border-white/15 p-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-sm text-white tracking-wide uppercase">
                  Digital Props &amp; Stickers
                </h3>
                <span className="text-xs text-white/50">({placedProps.length} placed)</span>
              </div>

              <div className="flex items-center gap-2">
                {placedProps.length > 0 && (
                  <button
                    onClick={() => onPropsChange([])}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white/80 active:scale-95 transition-all"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Props' },
                  { id: 'wedding', label: '👑 Wedding & Royal' },
                  { id: 'party', label: '🕶️ Party & Fun' },
                  { id: 'bubbles', label: '💬 Signs & Phrases' },
                  { id: 'fun', label: '✨ Sparkles & Hearts' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Props Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-48 overflow-y-auto pt-2 pb-1">
              {filteredCatalog.map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleAddProp(item)}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 flex flex-col items-center justify-center gap-1 min-h-[75px] text-center active:scale-95 transition-all cursor-pointer"
                >
                  {item.renderSvg ? (
                    <div
                      className="w-10 h-10 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: item.renderSvg }}
                    />
                  ) : (
                    <div className="text-[11px] font-black text-pink-300 leading-tight">
                      {item.text}
                    </div>
                  )}
                  <span className="text-[9px] text-white/60 font-bold truncate w-full">
                    {item.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Bake / Flatten applied digital props onto the final canvas photo
 * Returns data URL representing the merged image
 */
export async function bakePropsOntoPhoto(
  basePhotoUrl: string,
  props: PlacedProp[]
): Promise<string> {
  if (props.length === 0) return basePhotoUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 1800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(basePhotoUrl);

      // Draw base photo
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Render each prop in order
      let renderedCount = 0;
      if (props.length === 0) return resolve(canvas.toDataURL('image/jpeg', 0.96));

      props.forEach((prop) => {
        const posX = (prop.x / 100) * canvas.width;
        const posY = (prop.y / 100) * canvas.height;
        const baseSize = 120 * prop.scale;

        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate((prop.rotation * Math.PI) / 180);

        if (prop.renderSvg) {
          const svgBlob = new Blob([prop.renderSvg], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);
          const propImg = new Image();
          propImg.onload = () => {
            ctx.drawImage(propImg, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
            URL.revokeObjectURL(svgUrl);
            renderedCount++;
            if (renderedCount === props.length) {
              resolve(canvas.toDataURL('image/jpeg', 0.96));
            }
          };
          propImg.onerror = () => {
            renderedCount++;
            if (renderedCount === props.length) {
              resolve(canvas.toDataURL('image/jpeg', 0.96));
            }
          };
          propImg.src = svgUrl;
        } else if (prop.text) {
          // Render speech bubble badge
          ctx.font = 'bold 28px sans-serif';
          const textMetrics = ctx.measureText(prop.text);
          const padding = 16;
          const boxW = textMetrics.width + padding * 2;
          const boxH = 48;

          // Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 12;

          // Gradient bubble
          const grad = ctx.createLinearGradient(-boxW / 2, 0, boxW / 2, 0);
          grad.addColorStop(0, '#ec4899');
          grad.addColorStop(1, '#8b5cf6');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(prop.text, 0, 2);

          ctx.restore();
          renderedCount++;
          if (renderedCount === props.length) {
            resolve(canvas.toDataURL('image/jpeg', 0.96));
          }
        }
      });
    };

    img.onerror = () => resolve(basePhotoUrl);
    img.src = basePhotoUrl;
  });
}
