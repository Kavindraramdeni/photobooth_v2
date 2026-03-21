'use client';

/**
 * AIResultScreen — shown after capture in aistudio mode
 * Shows: generating state → original + AI side by side → share options
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Share2, Download, RotateCcw } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STYLE_LABELS: Record<string, { name: string; emoji: string; gradient: string }> = {
  anime:       { name: 'Anime Art',    emoji: '🎌', gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)' },
  cyberpunk:   { name: 'Cyberpunk',    emoji: '🌆', gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)' },
  vintage:     { name: 'Vintage Film', emoji: '📷', gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)' },
  watercolor:  { name: 'Watercolor',   emoji: '🎨', gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
  oilpainting: { name: 'Oil Painting', emoji: '🖼️', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  comic:       { name: 'Comic Book',   emoji: '💥', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
};

export function AIResultScreen() {
  const {
    currentPhoto, event, selectedAIStyle,
    setCurrentPhoto, setScreen,
    aiGenerating, setAIGenerating,
    aiProgress, setAIProgress,
  } = useBoothStore();

  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId]       = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const styleInfo = STYLE_LABELS[selectedAIStyle] || { name: selectedAIStyle, emoji: '✨', gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)' };

  // Auto-generate as soon as the screen mounts
  useEffect(() => {
    if (!currentPhoto?.id || !event?.id || generatedUrl) return;
    generateAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateAI() {
    if (!currentPhoto?.id || !event?.id) return;
    setAIGenerating(true);
    setAIProgress('Sending to AI...');
    setError(null);
    setGeneratedUrl(null);

    try {
      setAIProgress(`Applying ${styleInfo.name}...`);
      const form = new FormData();
      form.append('styleKey', selectedAIStyle);
      form.append('eventId', event.id);
      form.append('photoId', currentPhoto.id);

      const res = await fetch(`${API_BASE}/api/ai/generate`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'AI failed' }));
        throw new Error(err.error || 'AI generation failed');
      }
      const data = await res.json();
      setGeneratedUrl(data.ai.url);
      setAiPhotoId(data.ai.id || null);
      setAIProgress('');
      toast.success(`${styleInfo.emoji} ${styleInfo.name} applied!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      setError(msg.includes('MODEL_LOADING') ? 'AI is warming up — try again in 30 seconds' : msg);
      setAIProgress('');
    } finally {
      setAIGenerating(false);
    }
  }

  function handleUseAI() {
    if (!generatedUrl || !currentPhoto) return;
    setCurrentPhoto({ ...currentPhoto, url: generatedUrl, isAI: true, style: selectedAIStyle, id: aiPhotoId || currentPhoto.id });
    setScreen('share');
  }

  function handleUseOriginal() {
    setScreen('share');
  }

  function handleRetry() {
    generateAI();
  }

  // Share the AI image directly
  async function handleDirectShare() {
    if (!generatedUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ url: generatedUrl, title: `My ${styleInfo.name} photo` });
      } else {
        await navigator.clipboard.writeText(generatedUrl);
        toast.success('Link copied!');
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#080810] select-none">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
        <button
          onClick={() => setScreen('aistudio')}
          disabled={aiGenerating}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors disabled:opacity-30"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm">Change Style</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base">{styleInfo.emoji}</span>
          <h2 className="text-white font-bold text-sm">{styleInfo.name}</h2>
        </div>
        <div className="w-24" />
      </div>

      {/* Photos side by side */}
      <div className="flex-1 flex gap-2 p-3 min-h-0">

        {/* Original */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-widest text-center">Original</p>
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-white/5 min-h-0">
            {currentPhoto?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentPhoto.url} alt="Original" className="absolute inset-0 w-full h-full object-cover" />
            )}
          </div>
        </div>

        {/* AI Version */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest">AI Version</p>
          </div>
          <div
            className="flex-1 relative rounded-2xl overflow-hidden min-h-0 border-2 transition-colors"
            style={{ borderColor: generatedUrl ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)' }}
          >
            {/* Generating overlay */}
            <AnimatePresence>
              {aiGenerating && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90"
                >
                  {/* Animated gradient ring */}
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full animate-spin"
                      style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${styleInfo.gradient.split(',')[1].trim().slice(0,-1)} 360deg)`, padding: '3px' }}>
                      <div className="w-full h-full rounded-full bg-black/90" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">
                      {styleInfo.emoji}
                    </div>
                  </div>
                  <p className="text-white text-sm font-semibold text-center px-4">{aiProgress}</p>
                  <p className="text-white/30 text-xs mt-2">30–60 seconds</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error state */}
            {error && !aiGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <p className="text-red-400 text-xs text-center mb-3">{error}</p>
                <button onClick={handleRetry}
                  className="px-4 py-2 rounded-xl bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold">
                  Try Again
                </button>
              </div>
            )}

            {/* Generated image */}
            {generatedUrl && !aiGenerating && (
              <motion.img
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                src={generatedUrl}
                alt="AI version"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Empty state */}
            {!generatedUrl && !aiGenerating && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white/10" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2 space-y-2.5">
        {/* Use AI photo - primary */}
        <AnimatePresence>
          {generatedUrl && !aiGenerating && (
            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUseAI}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5"
              style={{ background: styleInfo.gradient, boxShadow: '0 0 30px rgba(124,58,237,0.3)' }}
            >
              <Sparkles className="w-5 h-5" />
              Use AI Photo & Share
            </motion.button>
          )}
        </AnimatePresence>

        {/* Secondary actions */}
        <div className="flex gap-2">
          {generatedUrl && !aiGenerating && (
            <button onClick={handleDirectShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/10 transition-colors">
              <Share2 className="w-4 h-4" />
              Share AI
            </button>
          )}
          <button onClick={handleUseOriginal}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4" />
            Use Original
          </button>
        </div>
      </div>
    </div>
  );
}
