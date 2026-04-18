'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Share2, ImagePlus, RotateCcw } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_STYLES = [
  { key: 'anime', name: 'Anime', emoji: '🎌', color: '#ff6b9d', gradient: 'linear-gradient(135deg,#ff6b9d,#c44dff)' },
  { key: 'cyberpunk', name: 'Cyberpunk', emoji: '🌆', color: '#00d4ff', gradient: 'linear-gradient(135deg,#00d4ff,#7b2fff)' },
  { key: 'vintage', name: 'Vintage Film', emoji: '📷', color: '#f7b733', gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)' },
  { key: 'renaissance', name: 'Renaissance', emoji: '🎨', color: '#a78bfa', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { key: 'comic', name: 'Comic Book', emoji: '💥', color: '#4facfe', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
  { key: 'statue', name: 'Marble Statue', emoji: '🏛️', color: '#e2e8f0', gradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8)' },
  { key: 'eighties', name: '80s Yearbook', emoji: '✨', color: '#fb923c', gradient: 'linear-gradient(135deg,#fb923c,#f43f5e)' },
  { key: 'psychedelic', name: 'Psychedelic', emoji: '🌈', color: '#a3e635', gradient: 'linear-gradient(135deg,#a3e635,#06b6d4)' },
  { key: 'pixelart', name: '8-bit Pixel', emoji: '🎮', color: '#34d399', gradient: 'linear-gradient(135deg,#34d399,#059669)' },
  { key: 'daguerreotype', name: '19th Century', emoji: '🎩', color: '#d4a574', gradient: 'linear-gradient(135deg,#d4a574,#92400e)' },
  { key: 'oilpainting', name: 'Oil Painting', emoji: '🖼️', color: '#f093fb', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { key: 'old', name: 'Aged', emoji: '👴', color: '#94a3b8', gradient: 'linear-gradient(135deg,#94a3b8,#475569)' },
];

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
          setStyles(
            DEFAULT_STYLES.map((d) => ({
              ...d,
              preview_image_url: `/assets/styles/${d.key}.jpg`,
            }))
          );
        }
      })
      .catch(() => {
        setStyles(
          DEFAULT_STYLES.map((d) => ({
            ...d,
            preview_image_url: `/assets/styles/${d.key}.jpg`,
          }))
        );
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

  return (
    <div className="w-full h-full flex flex-col bg-[#08080f]">
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT */}
        <div className="w-1/3 p-2">
          {currentPhoto?.url && (
            <img
              src={currentPhoto.url}
              className="w-full h-full object-cover rounded-xl"
            />
          )}
        </div>

        {/* RIGHT */}
        <div className="flex-1 flex flex-col">

          {step === 'select' && (
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2">
              {stylesLoading ? (
                <div className="col-span-3 flex justify-center items-center">
                  Loading...
                </div>
              ) : (
                styles.map((style) => (
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
                ))
              )}
            </div>
          )}

          {step === 'select' && selected && (
            <button
              onClick={handleGenerate}
              className="m-2 p-3 bg-purple-600 text-white rounded-xl"
            >
              Generate AI
            </button>
          )}

          {step === 'result' && (
            <div className="flex-1 flex flex-col">
              <img
                src={generatedUrl || ''}
                className="flex-1 object-cover"
              />
              <button
                onClick={handleShareAI}
                className="m-2 p-3 bg-green-600 text-white rounded-xl"
              >
                Share
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex-1 flex items-center justify-center">
              Generating...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
