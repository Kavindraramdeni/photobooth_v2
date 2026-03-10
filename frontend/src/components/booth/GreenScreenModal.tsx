'use client';

/**
 * GreenScreenModal
 *
 * Browser-side background removal using @imgly/background-removal (MIT, WASM).
 * Runs entirely in the browser — no backend needed, no API key.
 * After removal the guest can optionally pick a replacement background.
 *
 * Install: npm install @imgly/background-removal (frontend only)
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw, Check } from 'lucide-react';

interface GreenScreenModalProps {
  photo: { url: string; id: string };
  onClose: () => void;
  onApply: (newUrl: string) => void;
}

// Preset background options
const BACKGROUNDS = [
  { label: 'None (transparent)', value: 'transparent', preview: '' },
  { label: '🌃 City Night',      value: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80', preview: '🌃' },
  { label: '🏖️ Beach',           value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', preview: '🏖️' },
  { label: '🚀 Space',           value: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&q=80', preview: '🚀' },
  { label: '🌸 Garden',          value: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80', preview: '🌸' },
  { label: '🎨 Purple Studio',   value: 'gradient-purple', preview: '🎨' },
  { label: '🌅 Sunset',          value: 'gradient-sunset', preview: '🌅' },
];

type Stage = 'idle' | 'removing' | 'done' | 'error';

export function GreenScreenModal({ photo, onClose, onApply }: GreenScreenModalProps) {
  const [stage, setStage]               = useState<Stage>('idle');
  const [progress, setProgress]         = useState(0);
  const [removedDataUrl, setRemovedDataUrl] = useState<string | null>(null);
  const [selectedBg, setSelectedBg]     = useState('transparent');
  const [composited, setComposited]     = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function runRemoval() {
    setStage('removing');
    setProgress(10);
    try {
      // Dynamic import — only loads WASM when user clicks
      const { removeBackground } = await import('@imgly/background-removal');
      setProgress(30);

      // Fetch the photo as a blob
      const res  = await fetch(photo.url, { mode: 'cors' });
      const blob = await res.blob();
      setProgress(50);

      const resultBlob = await removeBackground(blob, {
        progress: (key, current, total) => {
          setProgress(50 + Math.round((current / total) * 40));
        },
      });
      setProgress(95);

      const dataUrl = await blobToDataUrl(resultBlob);
      setRemovedDataUrl(dataUrl);
      setStage('done');
      setProgress(100);
    } catch (err) {
      console.error('[GreenScreen] removal failed:', err);
      setStage('error');
    }
  }

  // Recomposite when bg or removed image changes
  useEffect(() => {
    if (!removedDataUrl || stage !== 'done') return;
    compositeImage(removedDataUrl, selectedBg).then(setComposited);
  }, [removedDataUrl, selectedBg, stage]);

  async function compositeImage(fgDataUrl: string, bg: string): Promise<string> {
    const canvas = canvasRef.current;
    if (!canvas) return fgDataUrl;

    const fg = await loadImg(fgDataUrl);
    canvas.width  = fg.width;
    canvas.height = fg.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bg === 'transparent') {
      // Just the person, no background
    } else if (bg.startsWith('gradient-')) {
      const grad = bg === 'gradient-purple'
        ? ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        : ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      if (bg === 'gradient-purple') {
        grad.addColorStop(0, '#1e003d');
        grad.addColorStop(1, '#7c3aed');
      } else {
        grad.addColorStop(0, '#ff6b35');
        grad.addColorStop(0.5, '#f7c948');
        grad.addColorStop(1, '#ff3d6b');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      try {
        const bgImg = await loadImg(bg);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      } catch { /* skip if bg fails to load */ }
    }

    ctx.drawImage(fg, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  function handleApply() {
    const url = composited || removedDataUrl;
    if (url) onApply(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-[#141420] rounded-3xl w-full max-w-sm overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-base">🟢 Background Removal</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Preview */}
          <div className="rounded-2xl overflow-hidden bg-[#0a0a14] h-48 flex items-center justify-center relative"
            style={{
              backgroundImage: 'repeating-conic-gradient(#333 0% 25%, #1a1a1a 0% 50%)',
              backgroundSize: '16px 16px',
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={composited || removedDataUrl || photo.url}
              alt="preview"
              className="max-w-full max-h-full object-contain"
            />
            {stage === 'removing' && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <div className="w-full max-w-[140px] h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-white/70 text-sm">Removing background… {progress}%</p>
              </div>
            )}
          </div>

          {/* Hidden canvas for compositing */}
          <canvas ref={canvasRef} className="hidden" />

          {stage === 'idle' && (
            <button onClick={runRemoval}
              className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-500 flex items-center justify-center gap-3">
              <span>🟢</span> Remove Background
            </button>
          )}

          {stage === 'removing' && (
            <div className="w-full py-4 rounded-2xl bg-white/10 flex items-center justify-center gap-3 text-white/50">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Processing (first run may take 15s)…</span>
            </div>
          )}

          {stage === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm text-center">
                Background removal failed. Make sure you have internet access.
              </div>
              <button onClick={runRemoval} className="w-full py-3 rounded-xl bg-white/10 text-white/70 text-sm">Try again</button>
            </div>
          )}

          {stage === 'done' && (
            <>
              {/* Background picker */}
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Replace background</p>
                <div className="grid grid-cols-4 gap-2">
                  {BACKGROUNDS.map(bg => (
                    <button key={bg.value} onClick={() => setSelectedBg(bg.value)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg overflow-hidden border-2 transition-all ${
                        selectedBg === bg.value ? 'border-purple-500 scale-105' : 'border-white/10'
                      }`}
                      style={bg.value === 'transparent' ? { background: 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%)', backgroundSize: '8px 8px' }
                            : bg.value.startsWith('gradient') ? { background: bg.value === 'gradient-purple' ? 'linear-gradient(135deg,#1e003d,#7c3aed)' : 'linear-gradient(135deg,#ff6b35,#f7c948)' }
                            : { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      {bg.preview && <span>{bg.preview}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <button onClick={handleApply}
                className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-violet-500 flex items-center justify-center gap-3">
                <Check className="w-5 h-5" /> Apply &amp; Use This Photo
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
