'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, MoveHorizontal } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalUrl: string;
  transformedUrl: string;
  originalLabel?: string;
  transformedLabel?: string;
  className?: string;
  aspectRatio?: string;
}

export function BeforeAfterSlider({
  originalUrl,
  transformedUrl,
  originalLabel = 'ORIGINAL',
  transformedLabel = 'AI MASTERPIECE ✨',
  className = '',
  aspectRatio = '4/6',
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pos);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  }, [handleMove]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  }, [isDragging, handleMove]);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => setIsDragging(true)}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onClick={(e) => handleMove(e.clientX)}
      className={`relative select-none overflow-hidden rounded-3xl border border-white/20 shadow-2xl cursor-ew-resize group w-full max-w-[480px] min-w-[280px] h-full max-h-[72vh] mx-auto ${className}`}
      style={{ aspectRatio }}
    >
      {/* 1. Transformed (After) Image - Full background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={transformedUrl || originalUrl}
        alt="AI Transformed"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none bg-slate-900"
      />

      {/* 2. Original (Before) Image - Clipped by slider position */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none"
        style={{
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalUrl}
          alt="Original"
          className="absolute inset-0 w-full h-full object-cover bg-slate-900"
        />
      </div>

      {/* 3. Badges */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-lg">
          {originalLabel}
        </span>
      </div>

      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-600/80 text-white backdrop-blur-md border border-purple-400/40 shadow-lg flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-yellow-300" />
          {transformedLabel}
        </span>
      </div>

      {/* 4. Draggable Divider Line & Knob */}
      <div
        className="absolute top-0 bottom-0 z-20 pointer-events-none flex items-center justify-center"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        {/* Vertical divider line with neon glow */}
        <div className="w-1 h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8),0_0_24px_rgba(168,85,247,0.6)]" />

        {/* Center circular thumb handle */}
        <div className="absolute w-11 h-11 rounded-full bg-white/95 backdrop-blur-md border-2 border-purple-500 shadow-2xl flex items-center justify-center text-purple-700 pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform">
          <MoveHorizontal className="w-5 h-5 text-purple-600" />
        </div>
      </div>

      {/* 5. Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
        <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white/90 bg-black/50 backdrop-blur-md border border-white/10 shadow">
          ↔️ Slide to compare transformation
        </span>
      </div>
    </div>
  );
}
