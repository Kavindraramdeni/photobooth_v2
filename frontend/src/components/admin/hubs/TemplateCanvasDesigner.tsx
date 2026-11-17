'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Move,
  Maximize2,
  Type,
  Palette,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  Sliders,
  Eye,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CanvasTemplateConfig,
  DEFAULT_CANVAS_CONFIG_PORTRAIT,
  DEFAULT_CANVAS_CONFIG_LANDSCAPE,
} from '@/lib/cardTemplates';

interface TemplateCanvasDesignerProps {
  branding: Record<string, unknown>;
  onBrandingChange: (key: string, value: unknown) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

const LUXURY_PALETTES = [
  { name: 'Royal Gold', hex: '#d4af37' },
  { name: 'Champagne', hex: '#caa560' },
  { name: 'Bright Yellow', hex: '#fde047' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose Gold', hex: '#f43f5e' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Slate Gray', hex: '#94a3b8' },
  { name: 'Deep Black', hex: '#09090b' },
];

const FONTS = [
  { name: 'Cinzel (Royal Serif)', value: 'Cinzel, serif' },
  { name: 'Playfair Display (Luxury)', value: 'Playfair Display, serif' },
  { name: 'Montserrat (Modern Bold)', value: 'Montserrat, sans-serif' },
  { name: 'Great Vibes (Romantic Script)', value: 'Great Vibes, cursive' },
  { name: 'Oswald (Clean Condensed)', value: 'Oswald, sans-serif' },
];

const THEMES = [
  { id: 'dark-gold', label: 'Dark Gold Damask', bg: '#0d0e15', border: '#d4af37' },
  { id: 'ivory-silk', label: 'Ivory Wedding Silk', bg: '#faf7f2', border: '#caa560' },
  { id: 'midnight-gala', label: 'Midnight Gala', bg: '#07060f', border: '#8b5cf6' },
  { id: 'rose-quartz', label: 'Rose Quartz Gala', bg: '#1c0f14', border: '#f43f5e' },
  { id: 'clean-studio', label: 'Clean Studio White', bg: '#ffffff', border: '#0f172a' },
];

const SAMPLE_PHOTOS = [
  {
    label: 'Wedding Couple',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Party Celebration',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Kids Portrait',
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
  },
];

export function TemplateCanvasDesigner({
  branding,
  onBrandingChange,
  onSave,
  saving,
}: TemplateCanvasDesignerProps) {
  const existingConfig = branding.canvasTemplateConfig as CanvasTemplateConfig | undefined;
  const initialOrientation = (branding.cardOrientation as 'portrait' | 'landscape') || 'portrait';

  const [config, setConfig] = useState<CanvasTemplateConfig>(
    existingConfig ||
      (initialOrientation === 'landscape'
        ? DEFAULT_CANVAS_CONFIG_LANDSCAPE
        : DEFAULT_CANVAS_CONFIG_PORTRAIT)
  );

  const [activeTab, setActiveTab] = useState<'layout' | 'typography' | 'background' | 'ai_frames'>('layout');
  const [selectedLayer, setSelectedLayer] = useState<'photo' | 'headline' | 'names' | 'date' | 'hashtag'>('photo');
  const [samplePhotoIndex, setSamplePhotoIndex] = useState(0);

  // AI Frame Overlays State
  const [themePrompt, setThemePrompt] = useState('Luxury Tuscan Vineyard with Olive Leaves and Gold Foil');
  const [frameTitle, setFrameTitle] = useState(String(branding.templateHeadline || 'Celebration Gala'));
  const [frameSubtitle, setFrameSubtitle] = useState(String(branding.templateSubtitle || 'Thank You For Celebrating With Us'));
  const [frameSignature, setFrameSignature] = useState('With Love & Gratitude');
  const [generatingFrame, setGeneratingFrame] = useState(false);
  const [currentFrameOverlay, setCurrentFrameOverlay] = useState<string | null>(
    (branding.frameUrl as string) || null
  );

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleGenerateAIFrame = async () => {
    setGeneratingFrame(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeDescription: themePrompt,
          orientation: config.orientation,
          title: frameTitle,
          subtitle: frameSubtitle,
          signature: frameSignature,
          logoUrl: (branding.logoUrl as string) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Frame generation failed');
      setCurrentFrameOverlay(data.frameUrl);
      onBrandingChange('frameUrl', data.frameUrl);
      toast.success('✨ Transparent AI Frame generated & applied!');
    } catch (err: any) {
      toast.error(err.message || 'Could not generate frame');
    } finally {
      setGeneratingFrame(false);
    }
  };

  const handleDownloadFramePNG = () => {
    if (!currentFrameOverlay) {
      toast.error('No frame overlay generated yet');
      return;
    }
    const link = document.createElement('a');
    link.href = currentFrameOverlay;
    link.download = `frame_${config.orientation}_${Date.now()}.png`;
    link.click();
    toast.success('Transparent PNG exported!');
  };

  const isLandscape = config.orientation === 'landscape';

  const handleOrientationToggle = (orient: 'portrait' | 'landscape') => {
    const nextConfig =
      orient === 'landscape'
        ? { ...DEFAULT_CANVAS_CONFIG_LANDSCAPE, ...config, orientation: orient }
        : { ...DEFAULT_CANVAS_CONFIG_PORTRAIT, ...config, orientation: orient };
    setConfig(nextConfig);
    onBrandingChange('cardOrientation', orient);
  };

  const handleApplyTheme = (themeId: string) => {
    const t = THEMES.find((th) => th.id === themeId);
    if (!t) return;
    setConfig((prev) => ({
      ...prev,
      backgroundTheme: t.id,
      backgroundColor: t.bg,
      borderColor: t.border,
      photoSlot: {
        ...prev.photoSlot,
        borderColor: t.border,
      },
    }));
    toast.success(`Applied ${t.label} theme`);
  };

  const handleSaveToKiosk = async () => {
    onBrandingChange('cardTemplateId', 'custom-canvas');
    onBrandingChange('cardOrientation', config.orientation);
    onBrandingChange('canvasTemplateConfig', config);
    // Also sync headline / names to branding root for compatibility
    if (config.headline.text) onBrandingChange('templateHeadline', config.headline.text);
    if (config.names.text) onBrandingChange('templateNames', config.names.text);
    if (config.date.text) onBrandingChange('templateDate', config.date.text);

    await onSave();
    toast.success('✨ 4×6 Card Template saved and synced to all kiosks!');
  };

  const samplePhoto = SAMPLE_PHOTOS[samplePhotoIndex].url;

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-3xl p-5 md:p-7 shadow-2xl text-white">
      {/* Top Header & Orientation Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black tracking-tight text-white">
              Visual Drag-and-Drop Template Canvas Designer
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            WYSIWYG 4×6 (1200×1800) &amp; 6×4 (1800×1200) photo slot, typography, and luxury border designer.
          </p>
        </div>

        {/* Orientation & Save Actions */}
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => handleOrientationToggle('portrait')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                !isLandscape ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Portrait 4×6
            </button>
            <button
              onClick={() => handleOrientationToggle('landscape')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isLandscape ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Landscape 6×4
            </button>
          </div>

          <button
            onClick={handleSaveToKiosk}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save & Sync to Booth'}
          </button>
        </div>
      </div>

      {/* Main Designer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 mt-6">
        {/* Left Side: Interactive Canvas Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3 text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">
              {isLandscape ? '6×4 Canvas (1800×1200 px)' : '4×6 Canvas (1200×1800 px)'}
            </span>
            <div className="flex items-center gap-2">
              <span>Sample:</span>
              <button
                onClick={() => setSamplePhotoIndex((i) => (i + 1) % SAMPLE_PHOTOS.length)}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-bold"
              >
                <ImageIcon className="w-3 h-3" />
                {SAMPLE_PHOTOS[samplePhotoIndex].label}
              </button>
            </div>
          </div>

          {/* Scaled Visual Canvas Container */}
          <div
            className="relative border-4 rounded-2xl shadow-2xl overflow-hidden select-none transition-all"
            style={{
              width: isLandscape ? '420px' : '310px',
              height: isLandscape ? '280px' : '465px',
              backgroundColor: config.backgroundColor || '#0d0e15',
              borderColor: config.borderColor || '#d4af37',
              borderWidth: `${Math.max(2, Math.round(config.borderWidth * 0.25))}px`,
            }}
          >
            {/* Background Theme Accents */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  config.backgroundTheme === 'dark-gold'
                    ? 'radial-gradient(circle at 50% 30%, #1c1d2e 0%, #0d0e15 100%)'
                    : config.backgroundTheme === 'ivory-silk'
                    ? 'radial-gradient(circle at 50% 20%, #faf7f2 0%, #ede2d1 100%)'
                    : config.backgroundTheme === 'midnight-gala'
                    ? 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #07060f 100%)'
                    : 'transparent',
              }}
            />

            {/* Draggable Photo Slot */}
            <div
              onClick={() => setSelectedLayer('photo')}
              className={`absolute cursor-pointer transition-all rounded-xl overflow-hidden group ${
                selectedLayer === 'photo' ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : ''
              }`}
              style={{
                left: `${config.photoSlot.xPercent}%`,
                top: `${config.photoSlot.yPercent}%`,
                width: `${config.photoSlot.widthPercent}%`,
                height: `${config.photoSlot.heightPercent}%`,
                transform: 'translate(-50%, -50%)',
                borderRadius: `${Math.round(config.photoSlot.radius * 0.25)}px`,
                border: `${config.photoSlot.borderWidth}px solid ${config.photoSlot.borderColor}`,
                boxShadow:
                  config.photoSlot.shadowBlur > 0
                    ? `0 10px ${Math.round(config.photoSlot.shadowBlur * 0.4)}px rgba(0,0,0,0.7)`
                    : 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={samplePhoto}
                alt="Template Photo Slot"
                className="w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white bg-black/40">
                Click to edit photo slot
              </div>
            </div>

            {/* Headline Layer */}
            {config.headline.enabled && (
              <div
                onClick={() => setSelectedLayer('headline')}
                className={`absolute inset-x-2 text-center cursor-pointer transition-all ${
                  selectedLayer === 'headline' ? 'outline-1 outline-dashed outline-amber-400' : ''
                }`}
                style={{
                  top: `${config.headline.yPercent}%`,
                  transform: 'translateY(-50%)',
                  color: config.headline.color,
                  fontSize: `${Math.round(config.headline.fontSize * 0.35)}px`,
                  fontFamily: config.headline.fontFamily,
                  letterSpacing: `${config.headline.letterSpacing || 1}px`,
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
              >
                {config.headline.text}
              </div>
            )}

            {/* Names Layer */}
            {config.names.enabled && (
              <div
                onClick={() => setSelectedLayer('names')}
                className={`absolute inset-x-2 text-center cursor-pointer transition-all ${
                  selectedLayer === 'names' ? 'outline-1 outline-dashed outline-amber-400' : ''
                }`}
                style={{
                  top: `${config.names.yPercent}%`,
                  transform: 'translateY(-50%)',
                  color: config.names.color,
                  fontSize: `${Math.round(config.names.fontSize * 0.35)}px`,
                  fontFamily: config.names.fontFamily,
                  letterSpacing: `${config.names.letterSpacing || 1}px`,
                  textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                }}
              >
                {config.names.text}
              </div>
            )}

            {/* Date Layer */}
            {config.date.enabled && (
              <div
                onClick={() => setSelectedLayer('date')}
                className={`absolute inset-x-2 text-center cursor-pointer transition-all ${
                  selectedLayer === 'date' ? 'outline-1 outline-dashed outline-amber-400' : ''
                }`}
                style={{
                  top: `${config.date.yPercent}%`,
                  transform: 'translateY(-50%)',
                  color: config.date.color,
                  fontSize: `${Math.round(config.date.fontSize * 0.35)}px`,
                  fontFamily: config.date.fontFamily,
                  letterSpacing: `${config.date.letterSpacing || 1}px`,
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
              >
                {config.date.text}
              </div>
            )}

            {/* Hashtag Layer */}
            {config.hashtag.enabled && (
              <div
                onClick={() => setSelectedLayer('hashtag')}
                className={`absolute inset-x-2 text-center cursor-pointer transition-all ${
                  selectedLayer === 'hashtag' ? 'outline-1 outline-dashed outline-amber-400' : ''
                }`}
                style={{
                  top: `${config.hashtag.yPercent}%`,
                  transform: 'translateY(-50%)',
                  color: config.hashtag.color,
                  fontSize: `${Math.round(config.hashtag.fontSize * 0.35)}px`,
                  fontFamily: config.hashtag.fontFamily,
                  letterSpacing: `${config.hashtag.letterSpacing || 1}px`,
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
              >
                {config.hashtag.text}
              </div>
            )}
            {/* Transparent AI Frame Overlay */}
            {currentFrameOverlay && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentFrameOverlay}
                alt="AI Frame Overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-20"
              />
            )}
          </div>
        </div>

        {/* Right Side: Visual Inspector & Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 bg-zinc-800/40 p-5 rounded-2xl border border-white/5">
          {/* Tab Selection */}
          <div className="flex border-b border-white/10 pb-3 gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'layout', label: 'Photo Slot & Layout', icon: Move },
              { id: 'typography', label: 'Typography & Text', icon: Type },
              { id: 'background', label: 'Themes & Borders', icon: Palette },
              { id: 'ai_frames', label: 'AI Frame Overlays', icon: Sparkles },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === t.id
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: PHOTO SLOT & LAYOUT */}
          {activeTab === 'layout' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">Photo Frame Geometry</span>
                <span className="text-[11px] text-amber-400 font-mono">
                  {config.photoSlot.widthPercent}% × {config.photoSlot.heightPercent}%
                </span>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 mb-1 block">Width ({config.photoSlot.widthPercent}%)</label>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    value={config.photoSlot.widthPercent}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, widthPercent: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Height ({config.photoSlot.heightPercent}%)</label>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={config.photoSlot.heightPercent}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, heightPercent: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Horizontal X Position ({config.photoSlot.xPercent}%)</label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={config.photoSlot.xPercent}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, xPercent: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Vertical Y Position ({config.photoSlot.yPercent}%)</label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={config.photoSlot.yPercent}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, yPercent: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Corner Radius ({config.photoSlot.radius}px)</label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={config.photoSlot.radius}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, radius: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Frame Border ({config.photoSlot.borderWidth}px)</label>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={config.photoSlot.borderWidth}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        photoSlot: { ...prev.photoSlot, borderWidth: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Photo Slot Border Color Palette */}
              <div className="pt-2 border-t border-white/5">
                <label className="text-[11px] text-zinc-400 block mb-2">Photo Slot Border Color</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {LUXURY_PALETTES.map((p) => (
                    <button
                      key={p.name}
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          photoSlot: { ...prev.photoSlot, borderColor: p.hex },
                        }))
                      }
                      title={p.name}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        config.photoSlot.borderColor === p.hex ? 'scale-125 border-white ring-2 ring-amber-400' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TYPOGRAPHY & TEXT */}
          {activeTab === 'typography' && (
            <div className="space-y-4">
              {/* Layer Selection Pill */}
              <div className="flex gap-2">
                {[
                  { id: 'headline', label: 'Headline' },
                  { id: 'names', label: 'Names / Monogram' },
                  { id: 'date', label: 'Date & City' },
                  { id: 'hashtag', label: 'Hashtag' },
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLayer(l.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedLayer === l.id
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              {/* Edit Selected Text Layer */}
              {selectedLayer !== 'photo' && (
                <div className="p-4 bg-zinc-900/60 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      {selectedLayer} Settings
                    </span>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config[selectedLayer].enabled}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            [selectedLayer]: { ...prev[selectedLayer], enabled: e.target.checked },
                          }))
                        }
                        className="rounded accent-amber-500"
                      />
                      <span>Show on card</span>
                    </label>
                  </div>

                  {/* Text Input */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Text Content</label>
                    <input
                      type="text"
                      value={config[selectedLayer].text}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          [selectedLayer]: { ...prev[selectedLayer], text: e.target.value },
                        }))
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Font Family Select */}
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Font Family</label>
                      <select
                        value={config[selectedLayer].fontFamily}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            [selectedLayer]: { ...prev[selectedLayer], fontFamily: e.target.value },
                          }))
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        {FONTS.map((f) => (
                          <option key={f.name} value={f.value}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Font Size Slider */}
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Font Size ({config[selectedLayer].fontSize}px)
                      </label>
                      <input
                        type="range"
                        min="14"
                        max="72"
                        value={config[selectedLayer].fontSize}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            [selectedLayer]: { ...prev[selectedLayer], fontSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  {/* Vertical Position Slider */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Vertical Y Position ({config[selectedLayer].yPercent}%)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={config[selectedLayer].yPercent}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          [selectedLayer]: { ...prev[selectedLayer], yPercent: Number(e.target.value) },
                        }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Text Color Picker */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1.5">Text Color</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      {LUXURY_PALETTES.map((p) => (
                        <button
                          key={p.name}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              [selectedLayer]: { ...prev[selectedLayer], color: p.hex },
                            }))
                          }
                          title={p.name}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            config[selectedLayer].color === p.hex ? 'scale-125 border-white ring-2 ring-amber-400' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: p.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: THEMES & BORDERS */}
          {activeTab === 'background' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-zinc-300 block">Luxury Event Presets</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => handleApplyTheme(th.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                      config.backgroundTheme === th.id
                        ? 'border-amber-400 bg-amber-500/10 shadow-md'
                        : 'border-white/10 bg-zinc-900/60 hover:border-white/30'
                    }`}
                  >
                    <div
                      className="w-full h-8 rounded-lg border"
                      style={{ backgroundColor: th.bg, borderColor: th.border }}
                    />
                    <span className="text-xs font-bold text-white leading-tight">{th.label}</span>
                  </button>
                ))}
              </div>

              {/* Card Outer Border Width */}
              <div className="pt-3 border-t border-white/5">
                <label className="text-xs text-zinc-400 block mb-1">
                  Card Border Thickness ({config.borderWidth}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="36"
                  value={config.borderWidth}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      borderWidth: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Card Border Color */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1.5">Card Border Color</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {LUXURY_PALETTES.map((p) => (
                    <button
                      key={p.name}
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          borderColor: p.hex,
                        }))
                      }
                      title={p.name}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        config.borderColor === p.hex ? 'scale-125 border-white ring-2 ring-amber-400' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI FRAME OVERLAYS ENGINE */}
          {activeTab === 'ai_frames' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-amber-400 block uppercase tracking-wider">
                  Describe Theme — AI Designs Transparent Frame
                </span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Generates an ornate transparent PNG frame layered with client logo, event title, and signature.
                </p>
              </div>

              {/* Theme Prompt Input */}
              <div>
                <label className="text-[11px] text-zinc-300 block mb-1 font-semibold">Event Theme Description</label>
                <textarea
                  rows={2}
                  value={themePrompt}
                  onChange={(e) => setThemePrompt(e.target.value)}
                  placeholder="e.g. Luxury Tuscan Vineyard with Olive Leaves and Gold Foil"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              {/* Title, Subtitle, Signature Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Event Title</label>
                  <input
                    type="text"
                    value={frameTitle}
                    onChange={(e) => setFrameTitle(e.target.value)}
                    placeholder="Rahul &amp; Priya Wedding"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={frameSubtitle}
                    onChange={(e) => setFrameSubtitle(e.target.value)}
                    placeholder="November 18, 2026 • Jaipur"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-zinc-400 block mb-1">Digital Signature</label>
                  <input
                    type="text"
                    value={frameSignature}
                    onChange={(e) => setFrameSignature(e.target.value)}
                    placeholder="With Love &amp; Gratitude"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateAIFrame}
                  disabled={generatingFrame}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {generatingFrame ? 'Designing Frame…' : 'Generate AI Frame'}
                </button>

                {currentFrameOverlay && (
                  <button
                    type="button"
                    onClick={handleDownloadFramePNG}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Export Transparent PNG</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
