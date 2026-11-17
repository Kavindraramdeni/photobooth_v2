'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  Share2,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  Printer,
  Sliders,
  Image as ImageIcon,
  Layers,
  Crown,
  Film,
  Zap,
  Palette,
  Camera,
  Heart,
} from 'lucide-react';
import { useBoothStore, Photo } from '@/lib/store';
import { ensureBoothToken, getBoothHeaders } from '@/lib/api';
import { getCardTemplateById, compositeCardPhoto } from '@/lib/cardTemplates';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface StyleItem {
  key: string;
  name: string;
  tagline: string;
  emoji: string;
  gradient: string;
  accentColor: string;
  badge?: string;
  preview_image_url?: string | null;
}

// 8 Curated, high-production commercial photobooth persona styles
const CURATED_STYLES: StyleItem[] = [
  {
    key: 'maharaja',
    name: 'Royal Maharaja',
    tagline: 'Imperial Mughal sherwani, jeweled kalgi & palace court',
    emoji: '👑',
    gradient: 'linear-gradient(135deg, #78350f, #b45309, #d97706)',
    accentColor: '#f59e0b',
    badge: 'Royal Wedding Favorite',
    preview_image_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'bollywood',
    name: 'Bollywood Hero',
    tagline: 'Blockbuster red carpet glamour & cinema rim lighting',
    emoji: '🎬',
    gradient: 'linear-gradient(135deg, #1e1b4b, #312e81, #4f46e5)',
    accentColor: '#6366f1',
    badge: 'Popular',
    preview_image_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk 2099',
    tagline: 'Electric neon rain, cyber visor & futuristic megacity',
    emoji: '⚡',
    gradient: 'linear-gradient(135deg, #0f172a, #581c87, #06b6d4)',
    accentColor: '#06b6d4',
    badge: 'Futuristic',
    preview_image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'pixar',
    name: '3D Animation',
    tagline: 'Charming Disney / Pixar animated character styling',
    emoji: '🎨',
    gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)',
    accentColor: '#ec4899',
    badge: 'Family Favorite',
    preview_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'hollywood_noir',
    name: 'Vintage Hollywood',
    tagline: '1940s silver screen monochrome & high-contrast elegance',
    emoji: '🎞️',
    gradient: 'linear-gradient(135deg, #18181b, #27272a, #52525b)',
    accentColor: '#e4e4e7',
    badge: 'Timeless',
    preview_image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'mandap',
    name: 'Royal Mandap',
    tagline: 'Festive marigold courtyard & traditional palace floral arch',
    emoji: '🌺',
    gradient: 'linear-gradient(135deg, #831843, #be185d, #f97316)',
    accentColor: '#f97316',
    badge: 'Traditional',
    preview_image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'comic',
    name: 'Pop Art Comic',
    tagline: 'Bold Marvel comic panels, cel-shading & Ben-Day dots',
    emoji: '💥',
    gradient: 'linear-gradient(135deg, #b91c1c, #dc2626, #facc15)',
    accentColor: '#facc15',
    badge: 'Action',
    preview_image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80',
  },
  {
    key: 'eighties',
    name: 'Retro 80s Synth',
    tagline: 'Vibrant neon grid, synthwave sunset & retro film glow',
    emoji: '🪩',
    gradient: 'linear-gradient(135deg, #4a044e, #701a75, #c026d3)',
    accentColor: '#f43f5e',
    badge: 'Retro',
    preview_image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  },
];

type Step = 'select' | 'generating' | 'result';
type ViewMode = 'split' | 'card' | 'portrait';

const GENERATING_PHASES = [
  'Detecting facial landmarks & contours...',
  'Tailoring royal attire & accessories...',
  'Sculpting cinematic studio lighting & depth...',
  'Finalizing high-definition commemorative portrait...',
];

/**
 * Client-side canvas aesthetic stylizer (Zero-Failure Fallback)
 * If cloud AI is unreachable or offline, applies an instant high-quality
 * artistic color grade so the guest never experiences a broken screen.
 */
async function applyClientAestheticFilter(sourceUrl: string, styleKey: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 1800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(sourceUrl);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply distinct artistic treatments per style
      if (styleKey === 'hollywood_noir') {
        // Silver screen B&W
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // S-curve contrast
          const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.35 + 128));
          d[i] = contrast;
          d[i + 1] = contrast;
          d[i + 2] = contrast;
        }
        ctx.putImageData(imgData, 0, 0);
      } else if (styleKey === 'maharaja') {
        // Royal amber-gold warmth
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.globalCompositeOperation = 'color';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(180, 83, 9, 0.12)';
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else if (styleKey === 'cyberpunk') {
        // Neon cyan / magenta shift
        ctx.save();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else if (styleKey === 'bollywood') {
        // Cinematic warm rim
        ctx.save();
        ctx.fillStyle = 'rgba(238, 242, 255, 0.12)';
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.14)';
        ctx.globalCompositeOperation = 'color';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else if (styleKey === 'mandap') {
        // Marigold golden festive
        ctx.save();
        ctx.fillStyle = 'rgba(251, 146, 60, 0.20)';
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        // Vibrant pop
        ctx.save();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
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

  const [styles, setStyles] = useState<StyleItem[]>(CURATED_STYLES);
  const [selectedStyleKey, setSelectedStyleKey] = useState<string>('maharaja');
  const [step, setStep] = useState<Step>('select');
  const [generatingPhaseIndex, setGeneratingPhaseIndex] = useState(0);

  // Result state
  const [generatedPortraitUrl, setGeneratedPortraitUrl] = useState<string | null>(null);
  const [generatedCardUrl, setGeneratedCardUrl] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  // Active card template (e.g. Indian Wedding Mughal arch)
  const cardTemplateId = (event?.branding?.cardTemplateId as string | undefined) || 'indian-wedding-portrait';
  const activeTemplate = getCardTemplateById(cardTemplateId);

  // Resolve best photo sources
  // If the guest has a raw camera capture, prefer it for AI transformation
  const originalSourceUrl = currentPhoto?.rawUrl || currentPhoto?.url || '';
  const initialCardPreviewUrl = currentPhoto?.cardUrl || currentPhoto?.url || '';

  // Load custom event styles from server if configured, merging with curated defaults
  useEffect(() => {
    if (!event?.id) return;

    fetch(`${API_BASE}/api/events/${event.id}/styles`)
      .then((r) => r.json())
      .then((data) => {
        const customList = data.styles || [];
        if (customList.length > 0) {
          const customMapped: StyleItem[] = customList.map((s: any) => ({
            key: s.style_key || s.id,
            name: s.name,
            tagline: s.prompt ? s.prompt.slice(0, 55) + '...' : 'Custom Event Style',
            emoji: s.emoji || '✨',
            gradient: 'linear-gradient(135deg, #4c1d95, #6d28d9, #9333ea)',
            accentColor: '#a855f7',
            badge: 'Event Exclusive',
            preview_image_url: s.preview_image_url,
          }));

          // Put custom event styles first, followed by curated presets
          const combined = [...customMapped, ...CURATED_STYLES.filter((c) => !customMapped.some((m) => m.key === c.key))];
          setStyles(combined);
          setSelectedStyleKey(combined[0].key);
        }
      })
      .catch(() => {
        // Keep standard curated styles
      });
  }, [event?.id]);

  // Rotate status message during generation
  useEffect(() => {
    if (step !== 'generating') return;
    const interval = setInterval(() => {
      setGeneratingPhaseIndex((prev) => (prev + 1) % GENERATING_PHASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  const selectedStyle = styles.find((s) => s.key === selectedStyleKey) || styles[0];

  /**
   * Execute AI Transformation with Full Fallback & Re-compositing
   */
  async function handleGenerate() {
    if (!currentPhoto || !event?.id || aiGenerating) return;

    setStep('generating');
    setAIGenerating(true);
    setGeneratingPhaseIndex(0);

    let finalAiUrl: string | null = null;
    let finalAiId: string | null = null;

    try {
      const token = await ensureBoothToken(event.id);
      const headers = getBoothHeaders(event.id, currentPhoto.id);

      // Fetch the photo as a blob to send directly in form
      let photoBlob: Blob | null = null;
      try {
        const photoFetch = await fetch(originalSourceUrl);
        photoBlob = await photoFetch.blob();
      } catch (blobErr) {
        console.warn('[AIStudio] Could not fetch raw photo blob:', blobErr);
      }

      const form = new FormData();
      form.append('styleKey', selectedStyleKey);
      form.append('eventId', event.id);
      form.append('photoId', currentPhoto.id);
      if (token) {
        form.append('boothToken', token);
        form.append('sessionToken', token);
      }
      if (photoBlob) {
        form.append('file', photoBlob, 'photo.jpg');
        form.append('photo', photoBlob, 'photo.jpg');
      }

      const res = await fetch(`${API_BASE}/api/ai/generate`, {
        method: 'POST',
        headers,
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.ai?.url) {
          finalAiUrl = data.ai.url;
          finalAiId = data.ai.id;
        }
      }
    } catch (netErr: any) {
      console.warn('[AIStudio] Backend AI generate network notice:', netErr.message);
    }

    // Zero-Failure Fallback: If cloud AI was unreachable, apply client canvas filter
    if (!finalAiUrl) {
      console.log('[AIStudio] Engaging instant aesthetic fallback for style:', selectedStyleKey);
      finalAiUrl = await applyClientAestheticFilter(originalSourceUrl, selectedStyleKey);
      finalAiId = `ai-local-${Date.now()}`;
    }

    setGeneratedPortraitUrl(finalAiUrl);
    setAiPhotoId(finalAiId);

    // Re-composite into 4x6 commemorative card template
    if (activeTemplate && finalAiUrl) {
      try {
        const aiImgFetch = await fetch(finalAiUrl);
        const aiBlob = await aiImgFetch.blob();
        const cardBlob = await compositeCardPhoto(aiBlob, activeTemplate, {
          headline: (event?.branding?.templateHeadline as string) || undefined,
          subtitle: (event?.branding?.templateSubtitle as string) || undefined,
          names: (event?.branding?.templateNames as string) || undefined,
          date: (event?.branding?.templateDate as string) || undefined,
        });
        const cardUrl = URL.createObjectURL(cardBlob);
        setGeneratedCardUrl(cardUrl);
      } catch (compErr) {
        console.warn('[AIStudio] Re-composite card warning:', compErr);
        setGeneratedCardUrl(finalAiUrl);
      }
    } else {
      setGeneratedCardUrl(finalAiUrl);
    }

    setStep('result');
    setAIGenerating(false);
    toast.success('AI Transformation Complete! ✨', { icon: '✨' });
  }

  // Navigate to share screen with the transformed photo
  function handleContinueToShare() {
    if (!currentPhoto) return;

    // Use card URL if template active, or portrait URL
    const activeUrl = (viewMode === 'card' && generatedCardUrl) ? generatedCardUrl : (generatedPortraitUrl || currentPhoto.url);

    setCurrentPhoto({
      ...currentPhoto,
      url: activeUrl,
      rawUrl: originalSourceUrl,
      cardUrl: generatedCardUrl || activeUrl,
      isAI: true,
      style: selectedStyleKey,
      id: aiPhotoId || currentPhoto.id,
    });

    setScreen('share');
  }

  // Trigger quick 4x6 print
  function handleQuickPrint() {
    const printUrl = generatedCardUrl || generatedPortraitUrl || currentPhoto?.url;
    if (!printUrl) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>4x6 Print</title>
          <style>
            @page { size: 4in 6in portrait; margin: 0; }
            body { margin: 0; padding: 0; background: black; display: flex; align-items: center; justify-content: center; height: 100vh; }
            img { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${printUrl}" onload="window.print(); window.close();" />
        </body>
        </html>
      `);
      printWindow.document.close();
    }
    toast.success('Sent to printer! 🖨️');
  }

  function handleBack() {
    if (step === 'result') {
      setStep('select');
      setGeneratedPortraitUrl(null);
      setGeneratedCardUrl(null);
    } else {
      setScreen(currentPhoto ? 'preview' : 'style');
    }
  }

  const branding = event?.branding;
  const themeMode = (branding?.themeMode as string) || 'dark';
  const isLight = themeMode === 'light';
  const primaryColor = (branding?.primaryColor as string) || '#7c3aed';

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c1e] text-white select-none overflow-hidden relative z-10">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-[#111328]/90 backdrop-blur-xl border-b border-white/10 z-20">
        <button
          onClick={handleBack}
          className="text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/90 border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step === 'result' ? 'Change Style' : 'Back to Preview'}</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-black text-sm tracking-wide uppercase bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200 bg-clip-text text-transparent">
              SnapBooth AI Studio
            </h2>
            <p className="text-[10px] text-white/50 tracking-wider font-semibold">
              {step === 'select' && 'STEP 1 • CHOOSE YOUR AI PERSONA'}
              {step === 'generating' && 'STEP 2 • TRANSFORMING PORTRAIT'}
              {step === 'result' && 'STEP 3 • MASTERPIECE READY'}
            </p>
          </div>
        </div>

        {/* View Mode Pills (Only shown in Result step) */}
        {step === 'result' ? (
          <div className="flex items-center bg-white/10 p-1 rounded-2xl border border-white/15">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'split' ? 'bg-purple-600 text-white shadow-md' : 'text-white/70 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'card' ? 'bg-purple-600 text-white shadow-md' : 'text-white/70 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>4×6 Card</span>
            </button>
            <button
              onClick={() => setViewMode('portrait')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'portrait' ? 'bg-purple-600 text-white shadow-md' : 'text-white/70 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Full Art</span>
            </button>
          </div>
        ) : (
          <div className="w-24" />
        )}
      </div>

      {/* ── Main Split Kiosk Layout ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 z-10 relative">
        {/* ── LEFT PANE: Visual Stage ────────────────────────────────── */}
        <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col items-center justify-center flex-shrink-0 relative">
          <div className="relative w-full h-full max-h-[76vh] flex items-center justify-center">
            {/* STEP 1: SELECT PREVIEW */}
            {step === 'select' && (
              <div className="relative h-full max-h-[72vh] rounded-3xl overflow-hidden border-2 border-white/15 shadow-[0_0_40px_rgba(0,0,0,0.6)] bg-black/40 flex items-center justify-center" style={{ aspectRatio: '4/6' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={initialCardPreviewUrl || originalSourceUrl}
                  alt="Guest Portrait"
                  className="w-full h-full object-contain"
                />

                {/* Subtle overlay badge */}
                <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
                  <span className="px-4 py-2 rounded-full text-xs font-black tracking-wide bg-black/70 backdrop-blur-md text-white/90 border border-white/20 shadow-xl inline-flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    Pick an AI Look to Transform
                  </span>
                </div>
              </div>
            )}

            {/* STEP 2: GENERATING (Scanning Laser Beam Experience) */}
            {step === 'generating' && (
              <div className="relative h-full max-h-[72vh] rounded-3xl overflow-hidden border-2 border-purple-500/50 shadow-[0_0_50px_rgba(168,85,247,0.4)] bg-black/60 flex items-center justify-center" style={{ aspectRatio: '4/6' }}>
                {/* Source Photo being scanned */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSourceUrl}
                  alt="Scanning portrait"
                  className="w-full h-full object-cover filter brightness-75 contrast-125"
                />

                {/* Laser Scanning Line */}
                <motion.div
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2.8, ease: 'easeInOut', repeat: Infinity }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-500 shadow-[0_0_20px_#a855f7,0_0_40px_#ec4899] z-20 pointer-events-none"
                >
                  <div className="absolute inset-0 bg-white/60 blur-[1px]" />
                </motion.div>

                {/* Holographic grid overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-black/70 pointer-events-none" />

                {/* Live Progress Pill */}
                <div className="absolute bottom-6 left-6 right-6 text-center z-30">
                  <div className="px-5 py-3 rounded-2xl bg-black/80 backdrop-blur-xl border border-purple-500/40 shadow-2xl flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-purple-300 text-xs font-black tracking-wider uppercase">
                      <div className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                      <span>{selectedStyle.name} Transformation</span>
                    </div>
                    <p className="text-white/80 text-xs font-semibold">
                      {GENERATING_PHASES[generatingPhaseIndex]}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: RESULT PREVIEW (Split Slider, 4x6 Card, or Full Art) */}
            {step === 'result' && (
              <div className="relative w-full h-full flex items-center justify-center">
                {viewMode === 'split' && generatedPortraitUrl && (
                  <BeforeAfterSlider
                    originalUrl={originalSourceUrl}
                    transformedUrl={generatedPortraitUrl}
                    originalLabel="RAW PHOTO"
                    transformedLabel={`${selectedStyle.name.toUpperCase()} ✨`}
                    className="max-h-[72vh] w-auto shadow-2xl"
                  />
                )}

                {viewMode === 'card' && generatedCardUrl && (
                  <div className="relative h-full max-h-[72vh] rounded-3xl overflow-hidden border-2 border-purple-400/40 shadow-2xl bg-black" style={{ aspectRatio: '4/6' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedCardUrl}
                      alt="4x6 Card AI Artwork"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-md text-amber-300 border border-amber-400/30">
                        4×6 PRINT READY
                      </span>
                    </div>
                  </div>
                )}

                {viewMode === 'portrait' && generatedPortraitUrl && (
                  <div className="relative h-full max-h-[72vh] rounded-3xl overflow-hidden border-2 border-purple-400/40 shadow-2xl bg-black" style={{ aspectRatio: '4/6' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedPortraitUrl}
                      alt="Full Portrait AI Artwork"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-600/80 backdrop-blur-md text-white border border-purple-400/30">
                        HIGH-RES AI ARTWORK
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: Touch-Optimized Kiosk Control Hub ─────────── */}
        <div className="w-full md:w-1/2 flex flex-col bg-[#111328]/70 border-t md:border-t-0 md:border-l border-white/10 min-h-0 overflow-hidden">
          {/* STEP 1: CHOOSE LOOK */}
          {step === 'select' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 sm:p-6 pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>Choose Your Look</span>
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </h3>
                    <p className="text-white/60 text-xs mt-0.5">
                      Tap a persona tile below to transform your photo with studio AI
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold">
                    {styles.length} Styles
                  </div>
                </div>
              </div>

              {/* Styles Scrollable Grid (Frictionless, No text box!) */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 min-h-0">
                <div className="grid grid-cols-2 gap-3 pb-4">
                  {styles.map((style) => {
                    const isSelected = selectedStyleKey === style.key;
                    return (
                      <motion.button
                        key={style.key}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setSelectedStyleKey(style.key)}
                        className={`relative rounded-3xl p-3 text-left overflow-hidden border-2 transition-all flex flex-col justify-between min-h-[140px] cursor-pointer ${
                          isSelected
                            ? 'border-purple-400 ring-4 ring-purple-500/30 bg-purple-950/40 shadow-[0_0_24px_rgba(168,85,247,0.4)]'
                            : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        {/* Background Thumbnail if available */}
                        {style.preview_image_url && (
                          <div className="absolute inset-0 opacity-30 pointer-events-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={style.preview_image_url}
                              alt={style.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                          </div>
                        )}

                        {/* Top Row: Emoji & Badge / Check */}
                        <div className="flex items-center justify-between relative z-10">
                          <span className="text-2xl drop-shadow">{style.emoji}</span>
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : style.badge ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/15 text-white/80 border border-white/10">
                              {style.badge}
                            </span>
                          ) : null}
                        </div>

                        {/* Bottom Row: Name & Tagline */}
                        <div className="relative z-10 mt-3">
                          <p className="text-white font-black text-sm tracking-tight leading-tight">
                            {style.name}
                          </p>
                          <p className="text-white/60 text-[11px] leading-snug mt-1 line-clamp-2">
                            {style.tagline}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="p-4 sm:p-6 bg-[#0e1022]/90 border-t border-white/10 backdrop-blur-xl flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate}
                  disabled={aiGenerating}
                  className="w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Wand2 className="w-5 h-5 animate-bounce" />
                  <span>Transform into {selectedStyle.name} ✨</span>
                </motion.button>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING SCREEN */}
          {step === 'generating' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
              <div className="relative">
                <div className="w-28 h-28 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl animate-bounce">{selectedStyle.emoji}</span>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Crafting {selectedStyle.name} Look
                </h3>
                <p className="text-white/60 text-xs max-w-sm mt-2 leading-relaxed">
                  Our neural photo engine is applying authentic lighting, tailored garments, and high-fidelity art styling...
                </p>
              </div>

              <div className="w-full max-w-xs h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  animate={{ width: ['15%', '85%', '95%'] }}
                  transition={{ duration: 4, ease: 'easeInOut' }}
                />
              </div>
            </div>
          )}

          {/* STEP 3: RESULT ACTIONS */}
          {step === 'result' && (
            <div className="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="p-4 rounded-3xl bg-purple-950/30 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedStyle.emoji}</span>
                    <div>
                      <h4 className="font-black text-white text-base">
                        {selectedStyle.name} Masterpiece
                      </h4>
                      <p className="text-purple-300/80 text-xs">
                        High-definition 4×6 photo ready to print and share!
                      </p>
                    </div>
                  </div>
                </div>

                {/* View switcher description */}
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Souvenir Formats Included:
                  </p>
                  <ul className="text-xs text-white/60 space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <strong>4×6 Commemorative Wedding Card</strong> (with custom calligraphy)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <strong>High-Res Standalone AI Portrait</strong> (for phone wallpaper)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <strong>Interactive Before / After Split Slider</strong>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-6 border-t border-white/10">
                {/* 1. Share & Download (Primary) */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinueToShare}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Get Photo on Phone (QR & WhatsApp)</span>
                </motion.button>

                {/* 2. Print 4x6 Card */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleQuickPrint}
                  className="w-full py-3.5 px-6 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Print 4×6 Card Now</span>
                </motion.button>

                {/* 3. Try Another Look */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStep('select');
                    setGeneratedPortraitUrl(null);
                    setGeneratedCardUrl(null);
                  }}
                  className="w-full py-3 px-6 rounded-2xl bg-transparent hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try a Different Style</span>
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
