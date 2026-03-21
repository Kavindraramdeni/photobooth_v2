'use client';

/**
 * AIStudioScreen — New flow:
 * 1. Captured photo shown top-left, right side empty (waiting)
 * 2. 5 randomly picked styles shown as reference image cards (2-col grid)
 * 3. Guest selects one → sticky "Generate" CTA appears
 * 4. Generation → result fills top-right → share options
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Wand2, Share2, Download, RotateCcw } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── All 12 styles (borrowed from gembooth + your existing ones) ───────────────
const ALL_STYLES = [
  {
    key: 'anime',
    name: 'Anime',
    emoji: '🎌',
    prompt: "Make the person look like a photorealistic anime character with expressive features.",
    color: '#ff6b9d',
    gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)',
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: "Transform into a cyberpunk neon city style with glowing accents and futuristic clothing.",
    color: '#00d4ff',
    gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)',
  },
  {
    key: 'vintage',
    name: 'Vintage Film',
    emoji: '📷',
    prompt: "Make the photo look like a warm Kodachrome 1970s film photograph.",
    color: '#f7b733',
    gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)',
  },
  {
    key: 'renaissance',
    name: 'Renaissance',
    emoji: '🎨',
    prompt: "Make the person look like a Renaissance oil painting with classic lighting.",
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  },
  {
    key: 'comic',
    name: 'Comic Book',
    emoji: '💥',
    prompt: "Transform into a comic book panel with bold outlines, halftone dots, and vivid colors.",
    color: '#4facfe',
    gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',
  },
  {
    key: 'statue',
    name: 'Marble Statue',
    emoji: '🏛️',
    prompt: "Make the person look like a classical white marble statue.",
    color: '#e2e8f0',
    gradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8)',
  },
  {
    key: 'eighties',
    name: '80s Yearbook',
    emoji: '✨',
    prompt: "Make the person look like a 1980s yearbook photo with period-appropriate hair and clothing.",
    color: '#fb923c',
    gradient: 'linear-gradient(135deg,#fb923c,#f43f5e)',
  },
  {
    key: 'psychedelic',
    name: 'Psychedelic',
    emoji: '🌈',
    prompt: "Create a 1960s psychedelic poster illustration with bright bold colors and swirling shapes.",
    color: '#a3e635',
    gradient: 'linear-gradient(135deg,#a3e635,#06b6d4)',
  },
  {
    key: 'pixelart',
    name: '8-bit Pixel',
    emoji: '🎮',
    prompt: "Transform into a cute minimalist 8-bit pixel art character with bright colors.",
    color: '#34d399',
    gradient: 'linear-gradient(135deg,#34d399,#059669)',
  },
  {
    key: 'daguerreotype',
    name: '19th Century',
    emoji: '🎩',
    prompt: "Make the photo look like a 19th century daguerreotype with Victorian clothing and props.",
    color: '#d4a574',
    gradient: 'linear-gradient(135deg,#d4a574,#92400e)',
  },
  {
    key: 'oilpainting',
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: "Transform into a classic oil painting with rich textures and Rembrandt-style lighting.",
    color: '#f093fb',
    gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',
  },
  {
    key: 'old',
    name: 'Aged',
    emoji: '👴',
    prompt: "Make the person look extremely old with wrinkles and aged features, photorealistic.",
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg,#94a3b8,#475569)',
  },
];

// ── Pick 5 random styles — stable per session (useMemo with no deps) ──────────
function pickRandom5(): typeof ALL_STYLES {
  const shuffled = [...ALL_STYLES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

export function AIStudioScreen() {
  const {
    currentPhoto, event,
    setCurrentPhoto, setScreen,
    setAIGenerating, setAIProgress,
    aiGenerating,
  } = useBoothStore();

  // Pick 5 styles once when component mounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessionStyles = useMemo(() => pickRandom5(), []);

  const [selectedKey, setSelectedKey]     = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl]   = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId]         = useState<string | null>(null);
  const [step, setStep]                   = useState<'select' | 'result'>('select');

  const selectedStyle = sessionStyles.find(s => s.key === selectedKey);

  async function handleGenerate() {
    if (!selectedKey || !currentPhoto?.id || !event?.id || aiGenerating) return;
    const style = sessionStyles.find(s => s.key === selectedKey)!;

    setGeneratingKey(selectedKey);
    setAIGenerating(true);
    setAIProgress(`Creating ${style.name}...`);
    setGeneratedUrl(null);

    try {
      const form = new FormData();
      form.append('styleKey', selectedKey);
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
      setAIProgress('');
      setStep('result');
      toast.success(`${style.emoji} ${style.name} applied!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI failed';
      toast.error(msg.includes('MODEL_LOADING') ? 'AI warming up — try again in 30s' : msg);
    } finally {
      setAIGenerating(false);
      setGeneratingKey(null);
    }
  }

  function handleUseAI() {
    if (!generatedUrl || !currentPhoto) return;
    setCurrentPhoto({ ...currentPhoto, url: generatedUrl, isAI: true, style: selectedKey || '', id: aiPhotoId || currentPhoto.id });
    setScreen('share');
  }

  function handleUseOriginal() { setScreen('share'); }

  function handleRetryStyle() {
    setStep('select');
    setGeneratedUrl(null);
    setSelectedKey(null);
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#080810] select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
        <button
          onClick={() => aiGenerating ? null : (step === 'result' ? handleRetryStyle() : setScreen('idle'))}
          disabled={aiGenerating}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors disabled:opacity-30">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{step === 'result' ? 'Change Style' : 'Back'}</span>
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-bold text-sm">AI Art Studio</h2>
        </div>
        <div className="w-20" />
      </div>

      {/* ── Main body ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Photos row: original left, AI right ── */}
        <div className="flex-shrink-0 flex gap-2 px-4 pt-3 pb-2">

          {/* Original photo */}
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold text-center">Your Photo</p>
            <div className="relative rounded-2xl overflow-hidden bg-white/5" style={{ aspectRatio: '1/1' }}>
              {currentPhoto?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentPhoto.url} alt="Original" className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          {/* AI result / placeholder */}
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-center"
              style={{ color: generatedUrl ? (selectedStyle?.color || '#a78bfa') : 'rgba(255,255,255,0.3)' }}>
              {step === 'result' ? selectedStyle?.name : 'AI Version'}
            </p>
            <div
              className="relative rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: '1/1',
                background: generatedUrl ? 'transparent' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${generatedUrl ? (selectedStyle?.color + '60') : 'rgba(255,255,255,0.06)'}`,
              }}>

              {/* Generated image */}
              {generatedUrl && !aiGenerating && (
                <motion.img
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  src={generatedUrl} alt="AI version"
                  className="w-full h-full object-cover" />
              )}

              {/* Generating overlay */}
              <AnimatePresence>
                {aiGenerating && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
                    <div className="relative w-12 h-12 mb-2">
                      <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-violet-400 animate-spin"
                        style={{ borderWidth: '3px' }} />
                      <div className="absolute inset-0 flex items-center justify-center text-xl">
                        {sessionStyles.find(s => s.key === generatingKey)?.emoji}
                      </div>
                    </div>
                    <p className="text-white text-xs font-semibold">
                      {sessionStyles.find(s => s.key === generatingKey)?.name}...
                    </p>
                    <p className="text-white/30 text-[10px] mt-1">30–60 seconds</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {!generatedUrl && !aiGenerating && (
                <div className="flex flex-col items-center gap-1 p-3">
                  <Sparkles className="w-6 h-6 text-white/10" />
                  <p className="text-white/20 text-[10px] text-center leading-relaxed">
                    {selectedKey ? 'Tap Generate' : 'Pick a style below'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STEP: SELECT ── */}
        {step === 'select' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <p className="flex-shrink-0 text-white/40 text-[10px] uppercase tracking-widest font-semibold text-center py-1.5">
              Choose a style
            </p>

            {/* Style grid — 2 columns, scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <div className="grid grid-cols-2 gap-2.5">
                {sessionStyles.map((style, i) => {
                  const isSelected = selectedKey === style.key;
                  return (
                    <motion.button
                      key={style.key}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 24 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedKey(style.key)}
                      disabled={aiGenerating}
                      className="relative flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all overflow-hidden"
                      style={{
                        borderColor: isSelected ? style.color : 'rgba(255,255,255,0.07)',
                        background: isSelected
                          ? `${style.color}18`
                          : 'rgba(255,255,255,0.03)',
                        boxShadow: isSelected ? `0 0 20px ${style.color}30` : 'none',
                      }}>

                      {/* Gradient left edge */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                        style={{ background: style.gradient }} />

                      {/* Emoji */}
                      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: `${style.color}20` }}>
                        {style.emoji}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-bold text-sm leading-tight">{style.name}</p>
                        <p className="text-white/35 text-[10px] mt-0.5 leading-tight line-clamp-2">{style.prompt.slice(0, 40)}...</p>
                      </div>

                      {/* Selected check */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: style.color }}>
                          <span className="text-white text-[10px] font-black">✓</span>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Generate CTA — sticky, only when style selected */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.05]">
              <AnimatePresence>
                {selectedKey && (
                  <motion.button
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGenerate}
                    disabled={aiGenerating}
                    className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3 disabled:opacity-50"
                    style={{
                      background: selectedStyle?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)',
                      boxShadow: `0 0 30px ${selectedStyle?.color || '#7c3aed'}40`,
                    }}>
                    {aiGenerating
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
                      : <><Wand2 className="w-5 h-5" /> Generate {selectedStyle?.emoji} {selectedStyle?.name}</>
                    }
                  </motion.button>
                )}
              </AnimatePresence>

              {!selectedKey && (
                <p className="text-white/20 text-sm text-center py-2">
                  👆 Select a style to continue
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: RESULT ── */}
        {step === 'result' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col px-4 pt-3 pb-3 gap-3">

            {/* Style applied badge */}
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl self-center"
              style={{ background: `${selectedStyle?.color}20`, border: `1px solid ${selectedStyle?.color}40` }}>
              <span className="text-base">{selectedStyle?.emoji}</span>
              <span className="text-white/80 text-sm font-semibold">{selectedStyle?.name} applied</span>
              <span className="text-white/40 text-xs">✓</span>
            </div>

            {/* Share actions */}
            <div className="flex flex-col gap-2.5 flex-1 justify-center">

              {/* Primary — Use AI + Share */}
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleUseAI}
                className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3"
                style={{
                  background: selectedStyle?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)',
                  boxShadow: `0 0 30px ${selectedStyle?.color || '#7c3aed'}35`,
                }}>
                <Share2 className="w-5 h-5" />
                Share AI Photo
              </motion.button>

              {/* Download AI */}
              {generatedUrl && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = generatedUrl!;
                    a.download = 'ai-photo.jpg';
                    a.click();
                  }}
                  className="w-full py-3 rounded-2xl font-semibold text-white/70 text-sm flex items-center justify-center gap-2 bg-white/5 border border-white/8 hover:bg-white/10 transition-colors">
                  <Download className="w-4 h-4" />
                  Save to Camera Roll
                </motion.button>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-white/20 text-xs">or</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Try different style */}
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleRetryStyle}
                className="w-full py-3 rounded-2xl font-semibold text-white/50 text-sm flex items-center justify-center gap-2 hover:text-white/70 transition-colors">
                <RotateCcw className="w-4 h-4" />
                Try a Different Style
              </motion.button>

              {/* Use original */}
              <button
                onClick={handleUseOriginal}
                className="text-white/25 text-xs text-center py-1 hover:text-white/40 transition-colors">
                Use original photo instead
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
