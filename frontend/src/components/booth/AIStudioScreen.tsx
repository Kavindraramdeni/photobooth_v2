'use client';

/**
 * AIStudioScreen
 * NEW FLOW: Capture first → show photo → 6 style cards below → tap to generate
 * 
 * This screen is shown AFTER capture when mode === 'aistudio'
 * It replaces what was previously AIResultScreen for the style selection step.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Shuffle, Wand2 } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const AI_STYLES = [
  { key: 'anime',       name: 'Anime Art',    emoji: '🎌', desc: 'Studio Ghibli',  gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)', sample: '#ff6b9d' },
  { key: 'cyberpunk',   name: 'Cyberpunk',    emoji: '🌆', desc: 'Neon city',      gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)', sample: '#00d4ff' },
  { key: 'vintage',     name: 'Vintage Film', emoji: '📷', desc: 'Kodachrome',     gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)', sample: '#f7b733' },
  { key: 'watercolor',  name: 'Watercolor',   emoji: '🎨', desc: 'Soft painted',   gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', sample: '#43e97b' },
  { key: 'oilpainting', name: 'Oil Painting', emoji: '🖼️', desc: 'Classic art',    gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', sample: '#f093fb' },
  { key: 'comic',       name: 'Comic Book',   emoji: '💥', desc: 'Marvel style',   gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', sample: '#4facfe' },
];

export function AIStudioScreen() {
  const {
    currentPhoto, event,
    setCurrentPhoto, setScreen,
    setAIGenerating, setAIProgress,
    aiGenerating,
  } = useBoothStore();

  const [generatedUrl, setGeneratedUrl]   = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [activeStyle, setActiveStyle]     = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId]         = useState<string | null>(null);

  async function generate(styleKey: string) {
    if (!currentPhoto?.id || !event?.id || aiGenerating) return;
    setGeneratingKey(styleKey);
    setActiveStyle(styleKey);
    setAIGenerating(true);
    setAIProgress('Generating...');
    setGeneratedUrl(null);

    try {
      const form = new FormData();
      form.append('styleKey', styleKey);
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
      const style = AI_STYLES.find(s => s.key === styleKey);
      toast.success(`${style?.emoji} ${style?.name} applied!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI failed';
      toast.error(msg.includes('MODEL_LOADING') ? 'AI warming up — try again in 30s' : msg);
      setActiveStyle(null);
    } finally {
      setAIGenerating(false);
      setGeneratingKey(null);
    }
  }

  function handleSurprise() {
    const random = AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
    generate(random.key);
  }

  function handleUseAI() {
    if (!generatedUrl || !currentPhoto) return;
    setCurrentPhoto({ ...currentPhoto, url: generatedUrl, isAI: true, style: activeStyle || '', id: aiPhotoId || currentPhoto.id });
    setScreen('share');
  }

  function handleUseOriginal() {
    setScreen('share');
  }

  const activeStyleInfo = AI_STYLES.find(s => s.key === activeStyle);

  return (
    <div className="w-full h-full flex flex-col bg-[#080810] select-none overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
        <button onClick={() => setScreen('idle')}
          disabled={aiGenerating}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors disabled:opacity-30">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-bold text-sm">AI Art Studio</h2>
        </div>
        <div className="w-16" />
      </div>

      {/* Captured photo — shown prominently */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="relative rounded-2xl overflow-hidden bg-white/5 mx-auto"
          style={{ height: '200px', maxWidth: '320px' }}>
          {/* Original */}
          {currentPhoto?.url && !generatedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentPhoto.url} alt="Your photo"
              className="w-full h-full object-cover" />
          )}
          {/* Generated result */}
          {generatedUrl && (
            <motion.img
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              src={generatedUrl} alt="AI version"
              className="w-full h-full object-cover" />
          )}
          {/* Generating overlay */}
          <AnimatePresence>
            {aiGenerating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-10">
                <div className="relative w-14 h-14 mb-3">
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">
                    {AI_STYLES.find(s => s.key === generatingKey)?.emoji}
                  </div>
                </div>
                <p className="text-white text-xs font-semibold">Creating {AI_STYLES.find(s => s.key === generatingKey)?.name}...</p>
                <p className="text-white/30 text-xs mt-1">30–60 seconds</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Style label badge */}
          {activeStyleInfo && generatedUrl && (
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: activeStyleInfo.gradient }}>
              {activeStyleInfo.emoji} {activeStyleInfo.name}
            </div>
          )}
          {!generatedUrl && !aiGenerating && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-white/30 text-xs">Tap a style below to transform</span>
            </div>
          )}
        </div>
      </div>

      {/* Style cards grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2.5 text-center">
          Choose a style
        </p>
        <div className="grid grid-cols-3 gap-2">
          {AI_STYLES.map((style, i) => {
            const isActive = activeStyle === style.key;
            const isLoading = generatingKey === style.key;
            return (
              <motion.button key={style.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => generate(style.key)}
                disabled={aiGenerating}
                className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all disabled:opacity-50 overflow-hidden"
                style={{
                  borderColor: isActive ? style.sample : 'rgba(255,255,255,0.08)',
                  background: isActive ? `${style.sample}22` : 'rgba(255,255,255,0.04)',
                }}>
                {/* Gradient top bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: style.gradient }} />
                {isLoading
                  ? <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-white animate-spin" />
                  : <span className="text-2xl">{style.emoji}</span>
                }
                <span className="text-white text-[11px] font-bold leading-tight text-center">{style.name}</span>
                <span className="text-white/35 text-[9px] leading-tight text-center">{style.desc}</span>
                {isActive && !isLoading && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                    <span className="text-[8px] font-black" style={{ color: style.sample }}>✓</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Surprise Me */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSurprise}
          disabled={aiGenerating}
          className="w-full mt-3 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 text-sm"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
          <Shuffle className="w-4 h-4" />
          🎲 Surprise Me
        </motion.button>
      </div>

      {/* Bottom actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06] space-y-2">
        <AnimatePresence>
          {generatedUrl && !aiGenerating && (
            <motion.button
              key="use-ai"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUseAI}
              className="w-full py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2"
              style={{ background: activeStyleInfo?.gradient || 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
              <Wand2 className="w-4 h-4" />
              Use {activeStyleInfo?.name} & Share
            </motion.button>
          )}
        </AnimatePresence>
        <button onClick={handleUseOriginal}
          className="w-full py-2.5 rounded-xl text-white/40 text-sm font-medium hover:text-white/60 transition-colors">
          Use Original Instead
        </button>
      </div>
    </div>
  );
}
