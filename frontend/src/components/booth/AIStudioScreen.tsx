'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, ArrowLeft, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AIStudioScreen({ 
  event, 
  currentPhoto, 
  onBack,
  onConfirm,
  setScreen 
}: any) {
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedPhoto, setGeneratedPhoto] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadStyles();
  }, [event?.id]);

  async function loadStyles() {
    try {
      const response = await fetch(`${API_BASE}/api/events/${event.id}/styles`);
      if (response.ok) {
        const data = await response.json();
        setStyles(data.styles || []);
      }
    } catch (error) {
      console.warn('Failed to load styles:', error);
    }
  }

  async function generateAIPhoto(styleId: string) {
    if (!currentPhoto?.url) {
      toast.error('No photo to process');
      return;
    }

    setGeneratingId(styleId);
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/photos/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: currentPhoto.id,
          styleId,
          eventId: event.id,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      setGeneratedPhoto(data.generatedPhoto);
      setSelectedStyle(styleId);
      toast.success('AI photo generated!');
    } catch (error: any) {
      toast.error(error.message || 'Generation failed');
    } finally {
      setGeneratingId(null);
      setIsGenerating(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none overflow-hidden relative">
      {/* Header with Back Button */}
      <div className="flex-shrink-0 px-4 py-4 bg-[#0d0d1a]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white font-bold text-lg">AI Art Studio</h2>
        </div>
        
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Original Photo */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-white/60 text-sm font-semibold mb-2">Original Photo</p>
          <div className="flex-1 flex items-center justify-center bg-black/30 rounded-lg overflow-hidden">
            <motion.img
              src={currentPhoto?.url}
              alt="Original"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>

        {/* Generated Photo */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-white/60 text-sm font-semibold mb-2">AI Generated</p>
          <div className="flex-1 flex items-center justify-center bg-black/30 rounded-lg overflow-hidden relative">
            {generatedPhoto ? (
              <motion.img
                src={generatedPhoto.url}
                alt="Generated"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center text-white/50">
                <p>Select a style to generate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles Grid */}
      <div className="flex-shrink-0 px-4 py-4 bg-[#0d0d1a]/80 backdrop-blur-xl border-t border-white/10 max-h-[200px] overflow-y-auto">
        <p className="text-white/60 text-sm font-semibold mb-3">Choose Style</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {styles.map(style => (
            <motion.button
              key={style.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => generateAIPhoto(style.id)}
              disabled={isGenerating && generatingId === style.id}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                selectedStyle === style.id
                  ? 'border-violet-400 ring-2 ring-violet-500'
                  : 'border-white/10 hover:border-white/30'
              } ${isGenerating && generatingId === style.id ? 'opacity-50' : ''}`}
            >
              {style.thumbnail ? (
                <img
                  src={style.thumbnail}
                  alt={style.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center">
                  <span className="text-white text-xs font-bold text-center px-1">{style.name}</span>
                </div>
              )}

              {/* Loading Indicator */}
              {isGenerating && generatingId === style.id && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader className="w-6 h-6 text-white animate-spin" />
                </div>
              )}

              {/* Selected Checkmark */}
              {selectedStyle === style.id && generatingId !== style.id && (
                <div className="absolute top-1 right-1 bg-violet-500 rounded-full p-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs font-semibold px-1 py-1 text-center">
                {style.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex-shrink-0 px-4 py-4 bg-[#0d0d1a]/80 backdrop-blur-xl border-t border-white/10 flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Cancel
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (generatedPhoto) {
              onConfirm(generatedPhoto);
            } else {
              toast.error('Generate an AI photo first');
            }
          }}
          disabled={!generatedPhoto}
          className="flex-1 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Use This Photo
        </motion.button>
      </div>
    </div>
  );
}
