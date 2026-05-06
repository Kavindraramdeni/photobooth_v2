'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Share2, ImagePlus, RotateCcw, ArrowLeft, X } from 'lucide-react';
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
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      disabled={disabled}
      className="relative flex flex-col rounded-2xl overflow-hidden border-2 transition-all"
      style={{
        borderColor: isSelected ? style.color : 'rgba(255,255,255,0.08)',
        boxShadow: isSelected ? `0 0 20px ${style.color}50` : 'none',
        aspectRatio: '3/4',
      }}
    >
      {style.preview_image_url && !imgError ? (
        <img
          src={style.preview_image_url}
          alt={style.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: style.gradient }} />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {isSelected && (
        <div
          className="absolute inset-0 rounded-2xl border-2"
          style={{
            borderColor: style.color,
            boxShadow: `inset 0 0 20px ${style.color}30`,
          }}
        />
      )}

      <div className="absolute top-2 left-2 text-lg">{style.emoji}</div>

      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-white font-bold text-xs">{style.name}</p>
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

      const res = await fetch(`${API_BASE}/api/ai/generate`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();

      setGeneratedUrl(data.ai.url);
      setAiPhotoId(data.ai.id);
      setStep('result');

      toast.success('Generated!');
    } catch (e: any) {
      toast.error(e.message);
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
      // Back from result to style selection
      setStep('select');
      setGeneratedUrl(null);
      setSelected(null);
    } else {
      // Back from AI studio to camera
      setScreen('preview');
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#08080f]">
      {/* HEADER - Navigation & Title */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d0d1a]/80 backdrop-blur-xl border-b border-white/10">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </motion.button>

        <h2 className="text-white font-bold text-lg">✨ AI Studio</h2>

        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT - Original Photo Preview (2/5 width) */}
        <div className="w-2/5 p-4 flex items-center justify-center bg-black/20">
          {currentPhoto?.url ? (
            <div className="w-full h-full flex items-center justify-center bg-black rounded-2xl overflow-hidden">
              <img
                src={currentPhoto.url}
                alt="Original photo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="text-white/50 text-center">
              <ImagePlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No photo selected</p>
            </div>
          )}
        </div>

        {/* RIGHT - Style Selection & Generation (3/5 width) */}
        <div className="w-3/5 flex flex-col bg-[#0a0a0f]">
          {/* Status Bar */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/60 text-sm font-semibold">
              {step === 'select' && 'Choose a Style'}
              {step === 'generating' && '⏳ Generating...'}
              {step === 'result' && '✅ Preview Result'}
            </p>
            {selectedStyle && step === 'select' && (
              <p className="text-violet-300 text-sm mt-1">
                Selected: {selectedStyle.name} {selectedStyle.emoji}
              </p>
            )}
          </div>

          {/* STEP 1: SELECT STYLES */}
          {step === 'select' && (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                {stylesLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="text-white/60">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 animate-spin" />
                      <p>Loading styles...</p>
                    </div>
                  </div>
                ) : styles.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="text-white/60 text-center">
                      <p>No styles available</p>
                      <p className="text-sm mt-2">Create custom styles in admin</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {styles.map((style) => (
                      <StyleCard
                        key={style.key}
                        style={style}
                        isSelected={selected === style.key}
                        onSelect={() =>
                          setSelected(
                            selected === style.key ? null : style.key
                          )
                        }
                        disabled={aiGenerating}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <div className="p-4 border-t border-white/10">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGenerate}
                  disabled={!selected || aiGenerating}
                  className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    !selected || aiGenerating
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  <Wand2 className="w-5 h-5" />
                  {aiGenerating ? 'Generating...' : 'Generate AI Photo'}
                </motion.button>
              </div>
            </>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-12 h-12 text-violet-400" />
              </motion.div>
              <p className="text-white text-lg font-semibold">Generating your AI photo...</p>
              <p className="text-white/50 text-sm">This may take a moment</p>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'result' && (
            <>
              <div className="flex-1 overflow-hidden p-4">
                {generatedUrl ? (
                  <img
                    src={generatedUrl}
                    alt="Generated AI photo"
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-white/50">Loading...</p>
                  </div>
                )}
              </div>

              {/* Result Actions */}
              <div className="p-4 border-t border-white/10 space-y-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShareAI}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Share2 className="w-5 h-5" />
                  Share This Photo
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setStep('select');
                    setGeneratedUrl(null);
                    setSelected(null);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Try Another Style
                </motion.button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
