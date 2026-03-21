'use client';

/**
 * AIStudioScreen
 *
 * Flow:
 *   IdleScreen (AI Art) → CountdownScreen (capture) → AIStudioScreen
 *
 * Layout:
 *   - Left  half: captured photo (full height)
 *   - Right half: 2 rows × 3 cols style grid → tap one → Generate button
 *   - After generate: right half shows AI result
 *   - Bottom: Done (share both) | Share AI only
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Share2, ImagePlus } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── 12 styles ─────────────────────────────────────────────────────────────────
const ALL_STYLES = [
  { key: 'anime',        name: 'Anime',        emoji: '🎌', color: '#ff6b9d', gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)' },
  { key: 'cyberpunk',    name: 'Cyberpunk',     emoji: '🌆', color: '#00d4ff', gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)' },
  { key: 'vintage',      name: 'Vintage',       emoji: '📷', color: '#f7b733', gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)' },
  { key: 'renaissance',  name: 'Renaissance',   emoji: '🎨', color: '#a78bfa', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { key: 'comic',        name: 'Comic',         emoji: '💥', color: '#4facfe', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
  { key: 'statue',       name: 'Statue',        emoji: '🏛️', color: '#cbd5e1', gradient: 'linear-gradient(135deg,#cbd5e1,#94a3b8)' },
  { key: 'eighties',     name: '80s',           emoji: '✨', color: '#fb923c', gradient: 'linear-gradient(135deg,#fb923c,#f43f5e)' },
  { key: 'psychedelic',  name: 'Psychedelic',   emoji: '🌈', color: '#a3e635', gradient: 'linear-gradient(135deg,#a3e635,#06b6d4)' },
  { key: 'pixelart',     name: '8-bit',         emoji: '🎮', color: '#34d399', gradient: 'linear-gradient(135deg,#34d399,#059669)' },
  { key: 'daguerreotype',name: '19th Cent.',    emoji: '🎩', color: '#d4a574', gradient: 'linear-gradient(135deg,#d4a574,#92400e)' },
  { key: 'oilpainting',  name: 'Oil Paint',     emoji: '🖼️', color: '#f093fb', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { key: 'old',          name: 'Aged',          emoji: '👴', color: '#94a3b8', gradient: 'linear-gradient(135deg,#94a3b8,#475569)' },
];

function pickRandom5(): typeof ALL_STYLES {
  return [...ALL_STYLES].sort(() => Math.random() - 0.5).slice(0, 6);
}

type Step = 'select' | 'generating' | 'result';

export function AIStudioScreen() {
  const { currentPhoto, event, setCurrentPhoto, setScreen, setAIGenerating, aiGenerating } = useBoothStore();

  // Pick 6 styles once per session (2 rows × 3 cols)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const styles = useMemo(() => pickRandom5(), []);

  const [step, setStep]               = useState<Step>('select');
  const [selected, setSelected]       = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId]     = useState<string | null>(null);

  const selectedStyle = styles.find(s => s.key === selected);

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

  // Share AI photo only
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

  // Share both — pass original, AI available via gallery
  function handleShareBoth() {
    setScreen('share');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#08080f] select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-center px-5 py-3 border-b border-white/[0.06] relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-bold text-sm tracking-wide">AI Art Studio</h2>
        </div>
        {/* Step indicator */}
        <div className="absolute right-5 flex items-center gap-1.5">
          {['select','generating','result'].map((s, i) => (
            <div key={s} className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ background: step === s ? '#a78bfa' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>

      {/* ── Main: two columns ── */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">

        {/* LEFT — original photo */}
        <div className="flex-1 flex flex-col border-r border-white/[0.05] min-w-0">
          <div className="px-3 py-2 flex-shrink-0">
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold text-center">Your Photo</p>
          </div>
          <div className="flex-1 relative mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03]">
            {currentPhoto?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto.url}
                alt="Your photo"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/10 text-xs">No photo</div>
            )}
          </div>
        </div>

        {/* RIGHT — style picker / generating / result */}
        <div className="flex-1 flex flex-col min-w-0">

          <div className="px-3 py-2 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-center transition-colors"
              style={{ color: step === 'result' ? (selectedStyle?.color || '#a78bfa') : 'rgba(255,255,255,0.3)' }}>
              {step === 'result' ? `${selectedStyle?.name} ✓` : step === 'generating' ? 'Generating...' : 'AI Version'}
            </p>
          </div>

          <div className="flex-1 relative mx-3 mb-3 rounded-2xl overflow-hidden">

            {/* ── STEP: SELECT — 2×3 style grid ── */}
            {step === 'select' && (
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-1">
                  <div className="grid grid-cols-3 gap-1.5 h-full">
                    {styles.map((style, i) => {
                      const isSelected = selected === style.key;
                      return (
                        <motion.button
                          key={style.key}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setSelected(style.key)}
                          className="relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 transition-all overflow-hidden p-2"
                          style={{
                            borderColor: isSelected ? style.color : 'rgba(255,255,255,0.07)',
                            background: isSelected ? `${style.color}20` : 'rgba(255,255,255,0.03)',
                            boxShadow: isSelected ? `0 0 16px ${style.color}35` : 'none',
                            aspectRatio: '1 / 1',
                          }}>
                          {/* Gradient top bar */}
                          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                            style={{ background: style.gradient }} />
                          <span className="text-2xl leading-none">{style.emoji}</span>
                          <span className="text-white font-semibold text-[11px] leading-tight text-center">{style.name}</span>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: style.color }}>
                              <span className="text-white text-[8px] font-black">✓</span>
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: GENERATING ── */}
            {step === 'generating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                {/* Pulsing ring */}
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                    style={{ background: selectedStyle?.gradient }} />
                  <div className="absolute inset-0 rounded-full animate-spin border-4 border-transparent"
                    style={{ borderTopColor: selectedStyle?.color || '#a78bfa' }} />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">
                    {selectedStyle?.emoji}
                  </div>
                </div>
                <div className="text-center px-4">
                  <p className="text-white font-bold text-sm">{selectedStyle?.name}</p>
                  <p className="text-white/40 text-xs mt-1">30–60 seconds</p>
                </div>
                {/* Animated progress dots */}
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: selectedStyle?.color || '#a78bfa' }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP: RESULT ── */}
            {step === 'result' && generatedUrl && (
              <motion.img
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45 }}
                src={generatedUrl}
                alt="AI version"
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              />
            )}

            {/* Empty state (before any selection) */}
            {step === 'select' && !selected && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <span className="text-white/20 text-[10px] bg-black/40 px-3 py-1 rounded-full">Tap a style</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 border-t border-white/[0.05] px-4 py-3 space-y-2">

        {/* SELECT step — Generate CTA */}
        {step === 'select' && (
          <AnimatePresence>
            {selected ? (
              <motion.button
                key="generate"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
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
                className="w-full py-4 rounded-2xl text-white/20 text-sm font-medium text-center border border-white/[0.05]">
                Select a style above to continue
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* GENERATING step — disabled state */}
        {step === 'generating' && (
          <div className="w-full py-4 rounded-2xl font-bold text-white/40 text-sm flex items-center justify-center gap-3 border border-white/[0.05]">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Generating your AI art...
          </div>
        )}

        {/* RESULT step — share options */}
        {step === 'result' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-2">

            {/* Primary: share AI photo */}
            <button
              onClick={handleShareAI}
              className="w-full py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2.5"
              style={{
                background: selectedStyle?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)',
                boxShadow: `0 0 20px ${selectedStyle?.color || '#7c3aed'}30`,
              }}>
              <Share2 className="w-4 h-4" />
              Share AI Photo
            </button>

            {/* Secondary: share both (original + AI) */}
            <button
              onClick={handleShareBoth}
              className="w-full py-3 rounded-2xl font-semibold text-white/60 text-sm flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] transition-colors">
              <ImagePlus className="w-4 h-4" />
              Done — Share Original Too
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
