'use client';

/**
 * AIStudioScreen — iPad landscape optimised
 *
 * Layout (landscape):
 *   Left 40%  : captured photo (full height)
 *   Right 60% : scrollable 12-style grid (4 cols) with preview images
 *                → select → Generate button at bottom
 *                → generating overlay
 *                → result image + share options
 *
 * Style images: /assets/styles/{key}.jpg loaded from public folder
 * Falls back to gradient card if image missing
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Share2, ImagePlus, ChevronRight } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── All 12 styles — images served from /assets/styles/{key}.jpg ──────────────
const ALL_STYLES = [
  {
    key: 'anime',
    name: 'Anime',
    emoji: '🎌',
    color: '#ff6b9d',
    gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)',
    desc: 'Studio Ghibli',
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk',
    emoji: '🌆',
    color: '#00d4ff',
    gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)',
    desc: 'Neon city',
  },
  {
    key: 'vintage',
    name: 'Vintage Film',
    emoji: '📷',
    color: '#f7b733',
    gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)',
    desc: 'Kodachrome 70s',
  },
  {
    key: 'renaissance',
    name: 'Renaissance',
    emoji: '🎨',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
    desc: 'Da Vinci style',
  },
  {
    key: 'comic',
    name: 'Comic Book',
    emoji: '💥',
    color: '#4facfe',
    gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',
    desc: 'Marvel panel',
  },
  {
    key: 'statue',
    name: 'Marble Statue',
    emoji: '🏛️',
    color: '#e2e8f0',
    gradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8)',
    desc: 'Classical stone',
  },
  {
    key: 'eighties',
    name: '80s Yearbook',
    emoji: '✨',
    color: '#fb923c',
    gradient: 'linear-gradient(135deg,#fb923c,#f43f5e)',
    desc: 'Retro school',
  },
  {
    key: 'psychedelic',
    name: 'Psychedelic',
    emoji: '🌈',
    color: '#a3e635',
    gradient: 'linear-gradient(135deg,#a3e635,#06b6d4)',
    desc: 'Acid 60s',
  },
  {
    key: 'pixelart',
    name: '8-bit Pixel',
    emoji: '🎮',
    color: '#34d399',
    gradient: 'linear-gradient(135deg,#34d399,#059669)',
    desc: 'Retro game',
  },
  {
    key: 'daguerreotype',
    name: '19th Century',
    emoji: '🎩',
    color: '#d4a574',
    gradient: 'linear-gradient(135deg,#d4a574,#92400e)',
    desc: 'Victorian era',
  },
  {
    key: 'oilpainting',
    name: 'Oil Painting',
    emoji: '🖼️',
    color: '#f093fb',
    gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',
    desc: 'Rembrandt',
  },
  {
    key: 'old',
    name: 'Aged',
    emoji: '👴',
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg,#94a3b8,#475569)',
    desc: 'Future you',
  },
];

type Step = 'select' | 'generating' | 'result';

// ── Style card with preview image ─────────────────────────────────────────────
function StyleCard({
  style,
  isSelected,
  onSelect,
  disabled,
}: {
  style: typeof ALL_STYLES[0];
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = `/assets/styles/${style.key}.jpg`;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      disabled={disabled}
      className="relative flex flex-col w-full h-full rounded-2xl overflow-hidden border-2 transition-all"
      style={{
        borderColor: isSelected ? style.color : 'rgba(255,255,255,0.08)',
        boxShadow: isSelected ? `0 0 20px ${style.color}50` : 'none',  
      }}
    >
      {/* Preview image or gradient fallback */}
      {!imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={style.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: style.gradient }} />
      )}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Selected glow border overlay */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl border-2"
          style={{ borderColor: style.color, boxShadow: `inset 0 0 20px ${style.color}30` }} />
      )}

      {/* Selected check */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
          style={{ background: style.color }}>
          <span className="text-white text-[10px] font-black">✓</span>
        </motion.div>
      )}

      {/* Emoji top-left */}
      <div className="absolute top-2 left-2 text-lg z-10">{style.emoji}</div>

      {/* Name + desc at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
        <p className="text-white font-bold text-xs leading-tight">{style.name}</p>
        <p className="text-white/50 text-[10px] leading-tight">{style.desc}</p>
      </div>
    </motion.button>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function AIStudioScreen() {
  const {
    currentPhoto, event,
    setCurrentPhoto, setScreen,
    setAIGenerating, aiGenerating,
  } = useBoothStore();

  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId] = useState<string | null>(null);

  const selectedStyle = ALL_STYLES.find(s => s.key === selected);

  async function handleGenerate() {
    if (!selected || !currentPhoto?.id || !event?.id || aiGenerating) return;
    setStep('generating');
    setAIGenerating(true);
    setGeneratedUrl(null);

    try {
      const form = new FormData();
      form.append('styleKey', selected);
      form.append('eventId', event.id);
      form.append('photoId', currentPhoto.id);

      const res = await fetch(`${API_BASE}/api/ai/generate`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'AI generation failed');
      }
      const data = await res.json();
      setGeneratedUrl(data.ai.url);
      setAiPhotoId(data.ai.id || null);
      setStep('result');
      toast.success(`${selectedStyle?.emoji} ${selectedStyle?.name} applied!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI failed';
      toast.error(msg.includes('MODEL_LOADING') ? 'AI warming up — try again in 30s' : msg);
      setStep('select');
    } finally {
      setAIGenerating(false);
    }
  }

  function handleShareAI() {
    if (!generatedUrl || !currentPhoto) return;
    setCurrentPhoto({
      ...currentPhoto,
      url: generatedUrl,
      isAI: true,
      style: selected || '',
      id: aiPhotoId || currentPhoto.id,
    });
    setScreen('share');
  }

  function handleShareBoth() {
    setScreen('share');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#08080f] select-none overflow-hidden">
      <style>{`
        .booth-ai-body { flex-direction: column; }
        .booth-ai-left { width: 100%; height: 28vh; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .booth-ai-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
        @media (orientation: landscape) {
          .booth-ai-body { flex-direction: row; }
          .booth-ai-left { width: 36%; height: auto; border-bottom: none; border-right: 1px solid rgba(255,255,255,0.05); }
          .booth-ai-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-bold text-sm tracking-wide">AI Art Studio</h2>
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {(['select', 'generating', 'result'] as Step[]).map(s => (
            <div key={s} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{ background: step === s ? '#a78bfa' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>

      {/* ── Body: landscape = row, portrait = column ── */}
      <div className="booth-ai-body flex-1 flex min-h-0 overflow-hidden">

        {/* ── LEFT / TOP — original photo ── */}
        <div className="booth-ai-left flex-shrink-0 flex flex-col border-white/[0.05]">
          <p className="flex-shrink-0 text-white/30 text-[10px] uppercase tracking-widest font-semibold text-center py-1.5">
            Your Photo
          </p>
          <div className="flex-1 relative mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03]">
            {currentPhoto?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto.url}
                alt="Your photo"
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/10 text-xs">No photo</div>
            )}
          </div>
        </div>

        {/* ── RIGHT / BOTTOM — style picker or result ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Label row */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold transition-colors"
              style={{ color: step === 'result' ? (selectedStyle?.color || '#a78bfa') : 'rgba(255,255,255,0.3)' }}>
              {step === 'result'
                ? `${selectedStyle?.name} applied ✓`
                : step === 'generating'
                  ? 'Generating...'
                  : 'Choose a style'}
            </p>
            {step === 'select' && (
              <span className="text-white/20 text-[10px]">{ALL_STYLES.length} styles</span>
            )}
          </div>

          {/* ── SELECT: scrollable 4-col grid ── */}
          {step === 'select' && (
            <div className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-none">
              {/* landscape: 4 cols, portrait: 3 cols */}
              <div className="booth-ai-grid gap-2">
                {ALL_STYLES.map((style, i) => (
                  <motion.div
                    key={style.key}
                    className="relative w-full"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.03 }}
                    style={{ paddingTop: '133.3333%' }}>
                    <div className="absolute inset-0">
                      <StyleCard
                        style={style}
                        isSelected={selected === style.key}
                        onSelect={() => setSelected(selected === style.key ? null : style.key)}
                        disabled={aiGenerating}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── GENERATING: overlay ── */}
          {step === 'generating' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{ background: selectedStyle?.gradient }} />
                <div className="absolute inset-0 rounded-full animate-spin border-4 border-transparent"
                  style={{ borderTopColor: selectedStyle?.color || '#a78bfa' }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  {selectedStyle?.emoji}
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-base">{selectedStyle?.name}</p>
                <p className="text-white/40 text-sm mt-1">30–60 seconds</p>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full"
                    style={{ background: selectedStyle?.color || '#a78bfa' }}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT: generated image ── */}
          {step === 'result' && generatedUrl && (
            <div className="flex-1 relative mx-3 rounded-2xl overflow-hidden">
              <motion.img
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                src={generatedUrl}
                alt="AI version"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Style badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                style={{ background: `${selectedStyle?.color}30`, border: `1px solid ${selectedStyle?.color}60`, color: selectedStyle?.color }}>
                {selectedStyle?.emoji} {selectedStyle?.name}
              </div>
            </div>
          )}

          {/* ── Bottom action bar ── */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-white/[0.05] space-y-2">

            {/* SELECT */}
            {step === 'select' && (
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.button
                    key="gen"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGenerate}
                    className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3"
                    style={{
                      background: selectedStyle?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)',
                      boxShadow: `0 0 24px ${selectedStyle?.color || '#7c3aed'}40`,
                    }}>
                    <Wand2 className="w-5 h-5" />
                    Generate {selectedStyle?.emoji} {selectedStyle?.name}
                  </motion.button>
                ) : (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-full py-4 rounded-2xl text-white/20 text-sm font-medium text-center border border-white/[0.06]">
                    Tap a style to continue
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* GENERATING */}
            {step === 'generating' && (
              <div className="w-full py-4 rounded-2xl font-bold text-white/30 text-sm flex items-center justify-center gap-3 border border-white/[0.05]">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                Generating your AI art...
              </div>
            )}

            {/* RESULT */}
            {step === 'result' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex gap-2">
                <button
                  onClick={handleShareAI}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2"
                  style={{
                    background: selectedStyle?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)',
                    boxShadow: `0 0 18px ${selectedStyle?.color || '#7c3aed'}30`,
                  }}>
                  <Share2 className="w-4 h-4" />
                  Share AI Photo
                </button>
                <button
                  onClick={handleShareBoth}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-white/60 text-sm flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.07]">
                  <ImagePlus className="w-4 h-4" />
                  Share Original
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
