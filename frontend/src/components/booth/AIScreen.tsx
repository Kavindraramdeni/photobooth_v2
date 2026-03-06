'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Shuffle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { generateAI, generateSurpriseAI, getAIStyles } from '@/lib/api';
import toast from 'react-hot-toast';

interface AIStyle {
  key: string;
  name: string;
  emoji: string;
}

export function AIScreen() {
  const {
    currentPhoto, event,
    setCurrentPhoto, setScreen,
    aiGenerating, setAIGenerating,
    aiProgress, setAIProgress,
  } = useBoothStore();

  const [styles, setStyles] = useState<AIStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generatedPhoto, setGeneratedPhoto] = useState<string | null>(null);

  useEffect(() => {
    getAIStyles().then(setStyles).catch(console.error);
  }, []);

  async function handleGenerate(styleKey: string) {
    if (!currentPhoto || !event || aiGenerating) return;

    setSelectedStyle(styleKey);
    setAIGenerating(true);
    setAIProgress('Starting AI magic...');
    setGeneratedPhoto(null);

    try {
      const res = await fetch(currentPhoto.url);
      const blob = await res.blob();

      setAIProgress('AI is painting your photo...');
      const result = await generateAI(blob, styleKey, event.id, currentPhoto.id);

      setGeneratedPhoto(result.ai.url);
      setAIProgress('');
      toast.success(`${result.ai.style} applied! ✨`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'AI generation failed';
      if (msg.includes('MODEL_LOADING')) {
        toast.error('AI model warming up — try again in 30 seconds');
      } else {
        toast.error(msg);
      }
      setAIProgress('');
    } finally {
      setAIGenerating(false);
    }
  }

  async function handleSurprise() {
    if (!currentPhoto || !event || aiGenerating) return;

    setAIGenerating(true);
    setAIProgress('🎲 Picking a random AI style...');
    setGeneratedPhoto(null);
    setSelectedStyle(null);

    try {
      const res = await fetch(currentPhoto.url);
      const blob = await res.blob();

      setAIProgress('✨ AI is surprising you...');
      const result = await generateSurpriseAI(blob, event.id);

      setGeneratedPhoto(result.ai.url);
      setSelectedStyle(result.ai.styleKey);
      setAIProgress('');
      toast.success(`${result.ai.emoji} ${result.ai.style} — Surprise!`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'AI generation failed';
      toast.error(msg.includes('MODEL_LOADING') ? 'AI warming up — try again soon' : msg);
      setAIProgress('');
    } finally {
      setAIGenerating(false);
    }
  }

  function handleUseAIPhoto() {
    if (!generatedPhoto || !currentPhoto) return;
    setCurrentPhoto({ ...currentPhoto, url: generatedPhoto, isAI: true, style: selectedStyle || '' });
    setScreen('share');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button
          onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          disabled={aiGenerating}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Magic
        </h2>
        <div className="w-16" />
      </div>

      {/* Split view: original + generated */}
      <div className="flex-1 flex gap-3 p-4 overflow-hidden min-h-0">
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-white/5">
          <div className="absolute top-3 left-3 bg-black/60 rounded-lg px-2 py-1 text-xs text-white/70">
            Original
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentPhoto?.url} alt="Original" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 relative rounded-2xl overflow-hidden bg-white/5 border border-purple-500/30">
          <div className="absolute top-3 left-3 bg-purple-600/80 rounded-lg px-2 py-1 text-xs text-white z-10">
            AI Version
          </div>

          {aiGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
              <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-4" />
              <p className="text-white text-sm text-center px-4">{aiProgress}</p>
              <p className="text-white/40 text-xs mt-2">HuggingFace free tier may take 30-60s</p>
            </div>
          )}

          {generatedPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={generatedPhoto} alt="AI generated" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-white/30">
                <Sparkles className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">Select a style below</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Style selector */}
      <div className="px-4 pb-4 space-y-3">
        {/* Surprise Me button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSurprise}
          disabled={aiGenerating}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-3
                     disabled:opacity-50 transition-all btn-touch glow-gold"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          <Shuffle className="w-5 h-5" />
          🎲 Surprise Me!
        </motion.button>

        {/* Style grid */}
        <div className="grid grid-cols-3 gap-2">
          {styles.map((style) => (
            <motion.button
              key={style.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleGenerate(style.key)}
              disabled={aiGenerating}
              className={`py-3 px-2 rounded-xl text-center transition-all btn-touch
                         disabled:opacity-50 border
                         ${selectedStyle === style.key
                           ? 'bg-purple-600/40 border-purple-500 text-white'
                           : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                         }`}
            >
              <div className="text-2xl mb-1">{style.emoji}</div>
              <div className="text-xs font-medium">{style.name}</div>
            </motion.button>
          ))}
        </div>

        {/* Use AI photo button */}
        <AnimatePresence>
          {generatedPhoto && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleUseAIPhoto}
              className="w-full py-4 rounded-2xl font-bold text-white btn-touch"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              ✅ Use This Photo & Share
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
