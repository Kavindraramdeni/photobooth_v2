'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Maximize2, ChevronUp, Share2, Check, AlertCircle, Wand2, RotateCw, Frame as FrameIcon } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Type definitions
interface EventSettings {
  countdownSeconds: number;
  photosPerSession: number;
  allowRetakes: boolean;
  allowAI: boolean;
  allowGIF: boolean;
  allowBoomerang: boolean;
  allowPrint: boolean;
  allowFrameOverlays?: boolean;
  allowBrandingOverlay?: boolean;
  allowEmailShare?: boolean;
  allowInstagram?: boolean;
  allowAirDrop?: boolean;
  allowWhatsApp?: boolean;
  [key: string]: any;
}

interface Event {
  id: string;
  name: string;
  slug: string;
  branding?: any;
  settings?: EventSettings;
}

interface Photo {
  id: string;
  url: string;
  [key: string]: any;
}

interface Frame {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  is_default: boolean;
}

export function PreviewScreen({
  photo,
  event,
  onShare,
  onRetake,
  setScreen,
  currentPhoto,
  resetTimer,
}: {
  photo: Photo | null;
  event: Event | null;
  onShare: (frame?: string) => void;
  onRetake: () => void;
  setScreen: (screen: string) => void;
  currentPhoto: Photo | null;
  resetTimer: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [showEffects, setShowEffects] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [availableFrames, setAvailableFrames] = useState<Frame[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [timeoutSecs] = useState(10);

  // Load frames on mount
  useEffect(() => {
    if (!currentPhoto?.url) {
      setScreen('idle');
    }

    // Load available frames
    if (event?.id && (event.settings?.allowFrameOverlays as boolean) !== false) {
      fetch(`${API_BASE}/api/events/${event.id}/frames`)
        .then((r) => r.json())
        .then((data) => {
          setAvailableFrames(data.frames || []);
          // Set default frame
          const defaultFrame = data.frames?.find((f: Frame) => f.is_default);
          if (defaultFrame) setSelectedFrame(defaultFrame.id);
        })
        .catch((err) => console.warn('Failed to load frames:', err));
    }
  }, [currentPhoto?.url, event?.id, setScreen, event?.settings?.allowFrameOverlays]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onShare(selectedFrame || undefined);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onShare, selectedFrame]);

  const EFFECTS = [
    { key: 'none', label: 'Normal', style: 'none' },
    { key: 'grayscale', label: 'B&W', style: 'grayscale(100%)' },
    { key: 'sepia', label: 'Sepia', style: 'sepia(100%)' },
    { key: 'saturate', label: 'Vivid', style: 'saturate(150%)' },
    { key: 'cool', label: 'Cool', style: 'hue-rotate(180deg)' },
  ];

  const actions = [
    {
      id: 'effects',
      icon: <Wand2 className="w-5 h-5" />,
      label: 'Effects',
      action: () => {},
      onClick: () => setShowEffects((v) => !v),
    },
    {
      id: 'frames',
      icon: <FrameIcon className="w-5 h-5" />,
      label: 'Frames',
      action: () => {},
      onClick: () => setShowFrames((v) => !v),
      hidden: (event?.settings?.allowFrameOverlays as boolean) === false || availableFrames.length === 0,
    },
  ];

  if (!photo) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-lg font-semibold">No photo captured</p>
          <button
            onClick={() => setScreen('capture')}
            className="mt-4 px-6 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-semibold"
          >
            Retake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]"
        onClick={resetTimer}
      >
        <button
          onClick={() => setScreen('capture')}
          className="text-white/50 hover:text-white transition-colors text-sm px-2 py-1"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base">Preview</h2>
          {timeoutSecs > 0 && <p className="text-white/30 text-[10px] mt-0.5">Auto-share in {timeLeft}s</p>}
        </div>
        <div className="w-12"></div>
      </div>

      {/* Photo Preview */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black p-4">
        <img
          src={photo.url}
          alt="Preview"
          className="max-w-full max-h-full object-contain rounded-xl"
          style={{ filter: EFFECTS.find((e) => e.key === activeFilter)?.style || 'none' }}
        />
      </div>

      {/* Effects Panel (slides up) */}
      <AnimatePresence>
        {showEffects && (
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-[#0d0d1a]/97 backdrop-blur-xl border-t border-white/10 px-4 pt-4 pb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-xs font-bold uppercase tracking-widest">🪄 Live Effects</span>
              <button
                onClick={() => setShowEffects(false)}
                className="text-white/30 hover:text-white/80 text-xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {EFFECTS.map((ef) => (
                <button
                  key={ef.key}
                  onClick={() => setActiveFilter(ef.key)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all ${
                    activeFilter === ef.key
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white/70'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                    <img
                      src={photo.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: ef.style }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold leading-none whitespace-nowrap">{ef.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frames Panel (slides up) */}
      <AnimatePresence>
        {(event?.settings?.allowFrameOverlays as boolean) !== false && availableFrames.length > 0 && showFrames && (
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-[#0d0d1a]/97 backdrop-blur-xl border-t border-white/10 px-4 pt-4 pb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-xs font-bold uppercase tracking-widest">🖼️ Frame Overlays</span>
              <button
                onClick={() => setShowFrames(false)}
                className="text-white/30 hover:text-white/80 text-xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {availableFrames
                .filter((f) => f.is_active)
                .map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => setSelectedFrame(frame.id)}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all ${
                      selectedFrame === frame.id
                        ? 'border-violet-400 bg-violet-500/20 text-violet-200 font-semibold'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white/70'
                    }`}
                  >
                    {frame.name}
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div
        className="flex-shrink-0 px-4 pb-safe-or-5 pt-2 border-t border-white/[0.06] bg-[#0d0d1a]/50 space-y-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {/* Action buttons */}
        <div className="flex gap-2 justify-center mb-3">
          {actions
            .filter((a) => !(a as any).hidden)
            .map((action) => (
              <motion.button
                key={action.id}
                whileTap={{ scale: 0.9 }}
                onClick={action.onClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all text-sm font-semibold"
              >
                {action.icon}
                {action.label}
              </motion.button>
            ))}
        </div>

        {/* Primary action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRetake}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
          >
            <RotateCw className="w-5 h-5" />
            Retake
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onShare(selectedFrame || undefined)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-lg shadow-violet-500/30"
          >
            <Share2 className="w-5 h-5" />
            Share
          </motion.button>
        </div>
      </div>
    </div>
  );
}
