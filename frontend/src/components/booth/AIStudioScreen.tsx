'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Share2, ImagePlus, RotateCcw, ArrowLeft, X, CheckCircle2 } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_STYLES: Style[] = [];

interface Style {
  key: string;
  name: string;
  emoji: string;
  color: string;
  gradient: string;
  preview_image_url?: string | null;
}

type Step = 'select' | 'generating' | 'result';

function StyleCard({ style, isSelected, onSelect, disabled }: any) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      disabled={disabled}
      className={`relative flex flex-col rounded-3xl overflow-hidden border transition-all duration-200 min-h-[110px] sm:min-h-[130px] w-full text-left cursor-pointer ${
        isSelected
          ? 'border-purple-400 ring-4 ring-purple-500/30 scale-[1.02] shadow-[0_0_24px_rgba(168,85,247,0.5)]'
          : 'border-white/10 hover:border-white/30 glass-panel'
      }`}
      style={{
        aspectRatio: '3/4',
      }}
    >
      {style.preview_image_url && !imgError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={style.preview_image_url}
          alt={style.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: style.gradient }} />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {isSelected && (
        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      )}

      <div className="absolute top-2.5 left-2.5 text-xl drop-shadow">{style.emoji}</div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-black text-xs sm:text-sm leading-tight truncate drop-shadow">{style.name}</p>
        <p className="text-white/60 text-[10px] mt-0.5 truncate">AI Filter</p>
      </div>
    </motion.button>
  );
}

export function AIStudioScreen() {
  const {
    currentPhoto,
    event,
    setCurrentPhoto,
    setScreen,
    setAIGenerating,
    aiGenerating,
  } = useBoothStore();

  const [styles, setStyles] = useState<Style[]>([]);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const selectedStyle = styles.find((s) => s.key === selected);

  useEffect(() => {
    if (!event?.id) return;

    setStylesLoading(true);

    fetch(`${API_BASE}/api/events/${event.id}/styles`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.styles || [];

        if (list.length > 0) {
          const mapped = list.map((s: any) => {
            const def = DEFAULT_STYLES.find((d) => d.key === s.style_key);

            return {
              key: s.style_key,
              name: s.name,
              emoji: s.emoji || '✨',
              color: def?.color || '#a78bfa',
              gradient:
                def?.gradient ||
                'linear-gradient(135deg,#a78bfa,#7c3aed)',
              preview_image_url: s.preview_image_url,
            };
          });

          setStyles(mapped);
        } else {
          setStyles([]);
        }
      })
      .catch(() => {
        setStyles([]);
      })
      .finally(() => setStylesLoading(false));
  }, [event?.id]);

  async function handleGenerate() {
    if (!selected || !currentPhoto?.id || !event?.id || aiGenerating) return;

    setStep('generating');
    setAIGenerating(true);

    try {
      const form = new FormData();
      form.append('styleKey', selected);
      form.append('eventId', event.id);
      form.append('photoId', currentPhoto.id);
      if (customPrompt.trim()) {
        form.append('prompt', customPrompt.trim());
      }

      const res = await fetch(`${API_BASE}/api/ai/generate`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();

      setGeneratedUrl(data.ai.url);
      setAiPhotoId(data.ai.id);
      setStep('result');

      toast.success('Generated! ✨');
    } catch (e: any) {
      toast.error(e.message || 'AI generation failed');
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

  function handleBack() {
    if (step === 'result') {
      setStep('select');
      setGeneratedUrl(null);
      setSelected(null);
    } else {
      setScreen('preview');
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#07070d] select-none overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 glass-panel z-20">
        <button
          onClick={handleBack}
          className="text-white/60 hover:text-white transition-colors text-xs font-bold px-3 py-1.5 rounded-xl glass-pill flex items-center gap-1 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-white font-black text-sm tracking-wide uppercase">AI Studio Magic</h2>
        </div>

        <div className="w-16" />
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 z-10 relative">
        {/* LEFT - Input Photo Preview */}
        <div className="w-full md:w-2/5 max-h-[30vh] sm:max-h-[35vh] md:max-h-none p-4 sm:p-6 flex items-center justify-center flex-shrink-0">
          {currentPhoto?.url ? (
            <div className="w-full h-full max-h-[70vh] flex items-center justify-center rounded-3xl overflow-hidden border border-white/15 shadow-2xl glass-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhoto.url}
                alt="Source photo"
                className="max-w-full max-h-full object-contain rounded-3xl"
              />
            </div>
          ) : (
            <div className="text-white/40 text-center">
              <ImagePlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No active photo</p>
            </div>
          )}
        </div>

        {/* RIGHT - Style Selection and Rendering */}
        <div className="w-full md:w-3/5 flex-1 flex flex-col bg-[#0a0a14] border-t md:border-t-0 md:border-l border-white/10 min-h-0 overflow-hidden">
          {/* Subheader */}
          <div className="px-6 py-3 border-b border-white/10 glass-panel flex items-center justify-between flex-shrink-0">
            <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
              {step === 'select' && '1. Choose Artistic Style'}
              {step === 'generating' && 'Rendering Artwork...'}
              {step === 'result' && 'Artwork Ready!'}
            </span>
            {selectedStyle && step === 'select' && (
              <span className="text-purple-300 text-xs font-semibold">
                {selectedStyle.name} {selectedStyle.emoji}
              </span>
            )}
          </div>

          {/* STEP 1: SELECT STYLES */}
          {step === 'select' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                {stylesLoading ? (
                  <div className="flex flex-col justify-center items-center h-full gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white/60 text-xs">Loading studio styles...</p>
                  </div>
                ) : styles.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full text-center p-6">
                    <Sparkles className="w-10 h-10 text-purple-400 mb-2 opacity-60" />
                    <p className="text-white font-bold text-sm">No Custom Styles Enabled</p>
                    <p className="text-white/40 text-xs mt-1">Configure styles in the Admin Design Hub.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
                    {styles.map((style) => (
                      <StyleCard
                        key={style.key}
                        style={style}
                        isSelected={selected === style.key}
                        onSelect={() =>
                          setSelected(selected === style.key ? null : style.key)
                        }
                        disabled={aiGenerating}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Prompt modifier */}
              <div className="px-6 pt-3 pb-2 border-t border-white/10 glass-panel flex-shrink-0">
                <label className="block text-white/70 text-xs font-bold mb-1.5">
                  ✨ Custom Style Modifier (Optional)
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="e.g. neon cyberpunk glow, comic book sketch, vaporwave..."
                  className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 text-white text-xs placeholder-white/30 focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              {/* Generate Button */}
              <div className="p-6 border-t border-white/10 glass-panel flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate}
                  disabled={!selected || aiGenerating}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    !selected || aiGenerating
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                  }`}
                >
                  <Wand2 className="w-5 h-5" />
                  {aiGenerating ? 'Transforming Photo...' : 'Apply AI Transformation'}
                </motion.button>
              </div>
            </>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                </div>
              </div>
              <h3 className="text-white text-xl font-black tracking-tight">Crafting Your AI Masterpiece</h3>
              <p className="text-white/50 text-xs max-w-xs">
                Analyzing portrait facial structure and applying neural aesthetic styling...
              </p>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'result' && (
            <>
              <div className="flex-1 overflow-hidden p-6 min-h-0 flex items-center justify-center">
                {generatedUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={generatedUrl}
                    alt="AI Artwork"
                    className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/15"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-white/50 text-xs">Loading Artwork...</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-white/10 glass-panel space-y-3 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShareAI}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-600/30 cursor-pointer"
                >
                  <Share2 className="w-5 h-5" />
                  Continue to Share &amp; Download
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStep('select');
                    setGeneratedUrl(null);
                    setSelected(null);
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl glass-pill hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try a Different Style
                </motion.button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
