'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Wand2,
  Printer,
  Image as ImageIcon,
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Trash2,
  Plus,
  Minus,
  RotateCw,
} from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { EmailCaptureModal } from '@/components/booth/EmailCaptureModal';
import { TemplateRenderer } from '@/components/booth/TemplateRenderer';
import { PROP_CATALOG, PropItem } from '@/components/booth/ARPropsOverlay';
import toast from 'react-hot-toast';

// ── Print helper — single page, robust layout ─────────────────────────────────
function printPhotoOnly(photoUrl: string, eventName: string, scale = 98) {
  const existing = document.getElementById('__snapbooth_print_frame');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__snapbooth_print_frame';
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) { window.open(photoUrl, '_blank'); return; }
  doc.open(); doc.close();
  const style = doc.createElement('style');
  style.textContent = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'html, body { width:100%; height:100%; overflow:hidden; background:#fff; }',
    '@page { margin:0; size:4in 6in portrait; }',
    '@media print { html, body { height:auto; overflow:hidden; }',
    '  * { page-break-after:avoid !important; page-break-before:avoid !important; page-break-inside:avoid !important; }',
    '  img { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }',
    '.wrap { display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:4in; height:6in; overflow:hidden; padding:0.15in; gap:0.08in; }',
    'img { width:100%; height:auto; max-height:5.4in; object-fit:contain; display:block; }',
    '.footer { font-size:8pt; color:#555; text-align:center; } .en { font-size:9pt; font-weight:bold; color:#333; }',
  ].join(' ');
  doc.head.appendChild(style);
  const wrap = doc.createElement('div'); wrap.className = 'wrap';
  const safeScale = Number.isFinite(scale) ? Math.max(70, Math.min(110, scale)) : 98;
  const img = doc.createElement('img'); img.src = photoUrl; img.alt = 'photo';
  img.style.width = `${safeScale}%`;
  img.style.margin = '0 auto';
  wrap.appendChild(img);
  const en = doc.createElement('p'); en.className = 'en'; en.textContent = eventName; wrap.appendChild(en);
  const ft = doc.createElement('p'); ft.className = 'footer';
  ft.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  wrap.appendChild(ft);
  doc.body.appendChild(wrap);
  function doPrint() { win!.focus(); win!.print(); }
  if (img.complete) { setTimeout(doPrint, 400); } else { img.onload = () => setTimeout(doPrint, 400); }
  setTimeout(() => { document.getElementById('__snapbooth_print_frame')?.remove(); }, 30000);
}

interface PlacedSticker {
  instanceId: string;
  propId: string;
  name: string;
  svg: string;
  xPercent: number; // 0-100% relative to photo container
  yPercent: number; // 0-100% relative to photo container
  scale: number;
  rotate: number;
}

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession, setEvent, setCurrentPhoto } = useBoothStore();
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [framesLoading, setFramesLoading] = useState(false);
  const [frames, setFrames] = useState<Array<{ id: string; name: string; url: string; isActive?: boolean }>>([]);
  const [showEffects, setShowEffects] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');

  // Interactive Drag & Drop Stickers state
  const [showStickers, setShowStickers] = useState(false);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [stickerCategory, setStickerCategory] = useState<'all' | 'eyewear' | 'headwear' | 'fun'>('all');
  const photoContainerRef = useRef<HTMLDivElement>(null);

  // Auto-reset ring (30 seconds)
  const RESET_SECONDS = 30;
  const [secondsLeft, setSecondsLeft] = useState(RESET_SECONDS);
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restartAutoResetTimer = useCallback(() => {
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    setSecondsLeft(RESET_SECONDS);
    resetTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (resetTimerRef.current) clearInterval(resetTimerRef.current);
          resetSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetSession]);

  useEffect(() => {
    restartAutoResetTimer();
    return () => {
      if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    };
  }, [restartAutoResetTimer]);

  useEffect(() => {
    if (!currentPhoto) setScreen('idle');
  }, [currentPhoto, setScreen]);

  if (!currentPhoto) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0a12] text-white/50 text-sm">
        Preparing studio preview...
      </div>
    );
  }
  const photo = currentPhoto;

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#6366f1';
  const themeMode = (branding?.themeMode as string) || 'dark';
  const isLight = themeMode === 'light';
  const eventName = (branding?.eventName as string) || event?.name || 'SnapBooth';
  const printScale = (settings?.printScale as number) || 98;

  const EFFECTS = [
    { key: 'none', label: 'Original Studio', style: 'none' },
    { key: 'kardashian_bw', label: 'Celebrity Glam B&W', style: 'grayscale(100%) contrast(136%) brightness(108%)' },
    { key: 'hollywood_glow', label: 'Hollywood Glow', style: 'sepia(24%) contrast(114%) brightness(108%) saturate(122%)' },
    { key: 'warm', label: 'Golden Hour', style: 'sepia(45%) saturate(140%) brightness(105%)' },
    { key: 'cool', label: 'Editorial Vogue', style: 'hue-rotate(190deg) saturate(110%) contrast(105%)' },
    { key: 'vivid', label: 'Cyber Vivid', style: 'saturate(170%) contrast(110%)' },
    { key: 'fade', label: 'Vintage Matte', style: 'contrast(88%) brightness(110%) saturate(85%)' },
  ];
  const currentFilter = EFFECTS.find(e => e.key === activeFilter)?.style || 'none';

  // ── Stickers Handlers ────────────────────────────────────────────────────────
  function addSticker(prop: PropItem) {
    const newSticker: PlacedSticker = {
      instanceId: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      propId: prop.id,
      name: prop.name,
      svg: prop.svg,
      xPercent: 50 + (Math.random() * 8 - 4),
      yPercent: prop.defaultY || 38,
      scale: prop.defaultScale || 1.0,
      rotate: 0,
    };
    setPlacedStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.instanceId);
    toast.success(`Added ${prop.name}! Drag anywhere.`);
  }

  function removeSticker(instanceId: string) {
    setPlacedStickers((prev) => prev.filter((s) => s.instanceId !== instanceId));
    if (selectedStickerId === instanceId) setSelectedStickerId(null);
    toast('Sticker removed', { icon: '🗑️' });
  }

  function changeStickerScale(instanceId: string, delta: number) {
    setPlacedStickers((prev) =>
      prev.map((s) =>
        s.instanceId === instanceId
          ? { ...s, scale: Math.max(0.4, Math.min(2.5, +(s.scale + delta).toFixed(2))) }
          : s
      )
    );
  }

  function changeStickerRotate(instanceId: string, deltaDeg: number) {
    setPlacedStickers((prev) =>
      prev.map((s) =>
        s.instanceId === instanceId ? { ...s, rotate: (s.rotate + deltaDeg) % 360 } : s
      )
    );
  }

  // ── Composite Stickers & Filter onto Photo for Permanent Sharing & Print ───
  async function bakeCustomizations(): Promise<string> {
    if (!photo?.url) return '';
    if (placedStickers.length === 0 && activeFilter === 'none') {
      return photo.url;
    }

    return new Promise((resolve) => {
      const img = new Image();
      if (photo.url.startsWith('http') && !photo.url.startsWith('http://localhost') && !photo.url.startsWith('https://localhost')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 1600;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(photo.url); return; }

        // 1. Draw photo with selected color grading filter
        if (currentFilter && currentFilter !== 'none') {
          ctx.filter = currentFilter;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // Reset so stickers keep their vivid vector colors

        // 2. Draw placed stickers in order
        for (const s of placedStickers) {
          try {
            const sImg = new Image();
            const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`;
            await new Promise<void>((r) => {
              sImg.onload = () => r();
              sImg.onerror = () => r();
              sImg.src = svgDataUri;
            });

            const baseW = canvas.width * 0.38 * s.scale;
            const ratio = (sImg.naturalHeight || 80) / (sImg.naturalWidth || 200);
            const baseH = baseW * ratio;
            const cx = (s.xPercent / 100) * canvas.width;
            const cy = (s.yPercent / 100) * canvas.height;

            ctx.save();
            ctx.translate(cx, cy);
            if (s.rotate) {
              ctx.rotate((s.rotate * Math.PI) / 180);
            }
            ctx.drawImage(sImg, -baseW / 2, -baseH / 2, baseW, baseH);
            ctx.restore();
          } catch (e) {
            console.warn('Failed to draw sticker:', e);
          }
        }

        const compositedUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve(compositedUrl);
      };

      img.onerror = () => resolve(photo.url);
      img.src = photo.url;
    });
  }

  async function handleDone() {
    let finalUrl = photo.url;
    if (placedStickers.length > 0 || activeFilter !== 'none') {
      const t = toast.loading('Finalizing studio keepsake...');
      finalUrl = await bakeCustomizations();
      setCurrentPhoto({
        ...photo,
        url: finalUrl,
        galleryUrl: finalUrl,
        downloadUrl: finalUrl,
      });
      toast.dismiss(t);
    }

    if (settings?.leadCapture) {
      setShowLeadModal(true);
    } else {
      setScreen('share');
    }
  }

  async function handlePrint() {
    if (!event) return;
    try {
      let finalUrl = photo.url;
      if (placedStickers.length > 0 || activeFilter !== 'none') {
        finalUrl = await bakeCustomizations();
        setCurrentPhoto({
          ...photo,
          url: finalUrl,
          galleryUrl: finalUrl,
          downloadUrl: finalUrl,
        });
      }
      printPhotoOnly(finalUrl, eventName, printScale);
      await trackAction(event.id, 'photo_printed', { photoId: photo.id });
      toast.success('Sent to printer! 🖨️');
    } catch {
      toast.error('Printer out of paper or disconnected');
    }
  }

  async function loadFrames() {
    if (!event?.id) return;
    setFramesLoading(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/events/${event.id}/frames`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load frames');
      setFrames((data.frames || []).filter((f: { isActive?: boolean }) => f.isActive !== false));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Frames unavailable');
    } finally {
      setFramesLoading(false);
    }
  }

  async function applyFrameToCurrentPhoto(frameUrl: string | null) {
    if (!currentPhoto?.url || !frameUrl) return;
    try {
      const [photoRes, frameRes] = await Promise.all([fetch(currentPhoto.url), fetch(frameUrl)]);
      const [photoBlob, frameBlob] = await Promise.all([photoRes.blob(), frameRes.blob()]);
      const photoBitmap = await createImageBitmap(photoBlob);
      const frameBitmap = await createImageBitmap(frameBlob);
      const canvas = document.createElement('canvas');
      canvas.width = photoBitmap.width;
      canvas.height = photoBitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(photoBitmap, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(frameBitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      setCurrentPhoto({ ...currentPhoto, url: dataUrl, galleryUrl: dataUrl, downloadUrl: dataUrl });
    } catch {}
  }

  function selectFrame(frameUrl: string | null) {
    if (!event) return;
    setEvent({
      ...event,
      branding: {
        ...event.branding,
        frameUrl,
      },
    });
    setShowFrames(false);
    if (frameUrl) applyFrameToCurrentPhoto(frameUrl);
  }

  const filteredProps = stickerCategory === 'all'
    ? PROP_CATALOG
    : PROP_CATALOG.filter((p) => p.category === stickerCategory);

  // Circular progress calculations for 30s auto-reset ring
  const circleRadius = 18;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (circleCircumference * secondsLeft) / RESET_SECONDS;

  return (
    <div
      className="w-full h-full flex flex-col justify-between bg-transparent select-none overflow-hidden relative z-10"
      onClick={() => {
        restartAutoResetTimer();
        setSelectedStickerId(null);
      }}
      onTouchStart={restartAutoResetTimer}
    >
      {/* Top Header: Clean, Minimalist Studio Bar */}
      <div
        className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b z-20 ${
          isLight
            ? 'bg-white/90 backdrop-blur-md border-black/5 text-slate-900 shadow-sm'
            : 'bg-[#121424]/90 backdrop-blur-md border-white/10 text-white shadow-md'
        }`}
      >
        <button
          onClick={() => setScreen('style')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${
            isLight
              ? 'bg-black/5 hover:bg-black/10 text-slate-700'
              : 'bg-white/10 hover:bg-white/15 text-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Style</span>
        </button>

        {/* Event Title */}
        <div className="text-center">
          <span className={`text-[10px] font-extrabold uppercase tracking-[0.25em] block ${
            isLight ? 'text-purple-600' : 'text-purple-400'
          }`}>
            Studio Customization Lab
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight truncate max-w-xs sm:max-w-md">
            {eventName}
          </h2>
        </div>

        {/* Auto-Reset 30s Countdown Ring */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Next guest
          </span>
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-9 h-9 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r={circleRadius}
                className={isLight ? 'stroke-slate-200' : 'stroke-white/10'}
                strokeWidth="3"
                fill="transparent"
              />
              <circle
                cx="18"
                cy="18"
                r={circleRadius}
                stroke={primaryColor}
                strokeWidth="3"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
              {secondsLeft}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Preview Stage & Action Dock */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 sm:p-8 gap-6 min-h-0 overflow-hidden">
        {/* Photo Canvas (Physical fine-art matte paper aesthetic with Interactive Stickers Overlay) */}
        <div className="relative flex-1 flex items-center justify-center w-full h-full max-h-[64vh] sm:max-h-[74vh]">
          <div
            ref={photoContainerRef}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStickerId(null);
            }}
            className={`relative rounded-3xl overflow-hidden max-h-full transition-all duration-300 ${
              isLight
                ? 'bg-white p-2.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border border-black/5'
                : 'bg-[#181938] p-2.5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] border border-white/10'
            }`}
          >
            {/* Filtered Photo + Branding Template */}
            <div
              className="relative rounded-2xl overflow-hidden transition-all duration-300"
              style={{ filter: currentFilter, transition: 'filter 0.3s ease' }}
            >
              <TemplateRenderer
                photoUrl={photo.url}
                eventName={eventName}
                template={{
                  layout: {
                    footerText: branding?.footerText,
                    logoUrl: branding?.logoUrl,
                    borderColor: branding?.secondaryColor,
                  },
                }}
              />

              {branding?.frameUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={branding.frameUrl as string}
                  alt="Frame overlay"
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl pointer-events-none select-none"
                  draggable={false}
                />
              )}
            </div>

            {/* Placed Interactive Drag-and-Drop Stickers */}
            {placedStickers.map((sticker) => {
              const isSelected = selectedStickerId === sticker.instanceId;
              return (
                <motion.div
                  key={sticker.instanceId}
                  drag
                  dragMomentum={false}
                  dragElastic={0.08}
                  dragConstraints={photoContainerRef.current ? photoContainerRef : { left: -150, right: 150, top: -150, bottom: 150 }}
                  onDragEnd={(_, info) => {
                    if (!photoContainerRef.current) return;
                    const rect = photoContainerRef.current.getBoundingClientRect();
                    if (!rect || rect.width <= 0 || rect.height <= 0) return;
                    setPlacedStickers((prev) =>
                      prev.map((s) => {
                        if (s.instanceId !== sticker.instanceId) return s;
                        const deltaX = (info.offset.x / rect.width) * 100;
                        const deltaY = (info.offset.y / rect.height) * 100;
                        const newX = Math.max(5, Math.min(95, s.xPercent + deltaX));
                        const newY = Math.max(5, Math.min(95, s.yPercent + deltaY));
                        return { ...s, xPercent: newX, yPercent: newY };
                      })
                    );
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStickerId(sticker.instanceId);
                  }}
                  className="absolute cursor-move select-none z-30 touch-none flex items-center justify-center group"
                  style={{
                    left: `${sticker.xPercent}%`,
                    top: `${sticker.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotate}deg)`,
                    width: `${sticker.scale * 130}px`,
                  }}
                >
                  {/* Selection Outline & Quick Delete / Resize Handles */}
                  {isSelected && (
                    <>
                      <div className="absolute -inset-2.5 border-2 border-dashed border-purple-400 rounded-2xl pointer-events-none animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                      {/* Delete X Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSticker(sticker.instanceId);
                        }}
                        className="absolute -top-3.5 -right-3.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white z-40 active:scale-90 transition-transform"
                        title="Delete sticker"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                      </button>
                      {/* Scale & Rotate Mini Controls */}
                      <div className="absolute -bottom-6 inset-x-0 flex items-center justify-center gap-1.5 z-40">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            changeStickerScale(sticker.instanceId, -0.15);
                          }}
                          className="w-6 h-6 bg-slate-900/90 text-white border border-white/20 rounded-full flex items-center justify-center text-xs font-black shadow-md hover:bg-purple-600 active:scale-90"
                          title="Smaller"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            changeStickerRotate(sticker.instanceId, 15);
                          }}
                          className="w-6 h-6 bg-slate-900/90 text-white border border-white/20 rounded-full flex items-center justify-center text-xs font-black shadow-md hover:bg-purple-600 active:scale-90"
                          title="Rotate"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            changeStickerScale(sticker.instanceId, 0.15);
                          }}
                          className="w-6 h-6 bg-slate-900/90 text-white border border-white/20 rounded-full flex items-center justify-center text-xs font-black shadow-md hover:bg-purple-600 active:scale-90"
                          title="Larger"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Render Vector Graphic */}
                  <div
                    className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: sticker.svg }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Studio Quick Actions Console */}
        <div className="flex md:flex-col gap-2.5 sm:gap-3 w-full md:w-48 flex-shrink-0 justify-center">
          {/* Retake Button (if allowed) */}
          {settings?.allowRetakes !== false && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen('countdown')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border border-black/10 text-slate-800'
                  : 'bg-[#16182e] hover:bg-[#1f2240] border border-white/15 text-white'
              }`}
            >
              <RefreshCw className="w-4 h-4 text-purple-400" />
              <span>Retake</span>
            </motion.button>
          )}

          {/* Interactive Stickers & Props Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowStickers((v) => !v);
              setShowEffects(false);
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md relative ${
              showStickers
                ? 'bg-purple-600 text-white border-2 border-purple-400'
                : isLight
                ? 'bg-white hover:bg-slate-50 border border-black/10 text-slate-800'
                : 'bg-[#16182e] hover:bg-[#1f2240] border border-white/15 text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Stickers {placedStickers.length > 0 && `(${placedStickers.length})`}</span>
          </motion.button>

          {/* Color Grading & Celebrity Glam Filters */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowEffects((v) => !v);
              setShowStickers(false);
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
              showEffects
                ? 'bg-amber-600 text-white border-2 border-amber-400'
                : isLight
                ? 'bg-white hover:bg-slate-50 border border-black/10 text-slate-800'
                : 'bg-[#16182e] hover:bg-[#1f2240] border border-white/15 text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 text-amber-400" />
            <span>Filters</span>
          </motion.button>

          {/* Frame Overlays (if enabled) */}
          {settings?.allowFrameOverlays && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={async (e) => {
                e.stopPropagation();
                setShowFrames(true);
                setShowStickers(false);
                setShowEffects(false);
                if (frames.length === 0) await loadFrames();
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border border-black/10 text-slate-800'
                  : 'bg-[#16182e] hover:bg-[#1f2240] border border-white/15 text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Frames</span>
            </motion.button>
          )}

          {/* Direct Print Button */}
          {settings?.allowPrint !== false && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                handlePrint();
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border border-black/10 text-slate-800'
                  : 'bg-[#16182e] hover:bg-[#1f2240] border border-white/15 text-white'
              }`}
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Print</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Interactive Stickers Tray Drawer */}
      <AnimatePresence>
        {showStickers && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            className={`mx-6 mb-4 p-4 rounded-3xl border-2 shadow-2xl z-30 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#181938] border-slate-700'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Add Props &amp; Stickers
                </span>
                <span className="text-xs text-purple-400 font-bold">
                  (Tap to add • Drag on photo • Tap to resize/delete)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {placedStickers.length > 0 && (
                  <button
                    onClick={() => {
                      setPlacedStickers([]);
                      setSelectedStickerId(null);
                      toast('Cleared all stickers', { icon: '🧹' });
                    }}
                    className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowStickers(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 mb-3">
              {[
                { id: 'all', label: 'All Props' },
                { id: 'eyewear', label: '🕶️ Shades' },
                { id: 'headwear', label: '👑 Hats & Crowns' },
                { id: 'fun', label: '🎉 Fun & FX' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setStickerCategory(c.id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    stickerCategory === c.id
                      ? 'bg-purple-600 text-white shadow-md'
                      : isLight
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Props Grid */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {filteredProps.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => addSticker(prop)}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 shadow-md ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 hover:border-purple-400 text-slate-800'
                      : 'bg-white/5 border-white/10 hover:border-purple-500 hover:bg-purple-600/10 text-white'
                  }`}
                >
                  <span className="text-2xl">{prop.icon}</span>
                  <div className="text-left">
                    <p className="text-xs font-black">{prop.name}</p>
                    <p className="text-[10px] opacity-60 capitalize">{prop.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Selector Tray */}
      <AnimatePresence>
        {showEffects && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className={`mx-6 mb-4 p-4 rounded-3xl border-2 shadow-2xl z-30 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#181938] border-slate-700'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Select Photo Filter &amp; Celebrity Glam
              </span>
              <button onClick={() => setShowEffects(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {EFFECTS.map((ef) => (
                <button
                  key={ef.key}
                  onClick={() => setActiveFilter(ef.key)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer ${
                    activeFilter === ef.key
                      ? 'border-indigo-500 bg-indigo-500/15'
                      : isLight
                      ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div
                    className="w-16 h-16 rounded-xl overflow-hidden border border-white/10"
                    style={{ filter: ef.style }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={ef.label} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-xs font-bold ${activeFilter === ef.key ? 'text-indigo-400' : isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {ef.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Bar: Done / Print & Share */}
      <div
        className={`flex-shrink-0 p-5 sm:p-6 border-t z-20 ${
          isLight ? 'bg-white/95 border-black/5 shadow-lg' : 'bg-[#121424]/95 border-white/10 shadow-2xl'
        }`}
      >
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => {
            e.stopPropagation();
            handleDone();
          }}
          className="w-full py-5 sm:py-6 rounded-2xl font-black text-lg sm:text-2xl text-white tracking-wide flex items-center justify-center gap-3 shadow-2xl cursor-pointer transition-all btn-arcade"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, #4338ca)`,
            boxShadow: `0 20px 50px ${primaryColor}55`,
          }}
        >
          <span>Looks Great! Continue to Share</span>
          <ArrowRight className="w-6 h-6 stroke-[3]" />
        </motion.button>
      </div>

      {/* Frames Modal */}
      <AnimatePresence>
        {showFrames && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-6 flex items-center justify-center"
            onClick={() => setShowFrames(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-xl bg-[#181938] border-2 border-slate-700 rounded-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-bold text-lg">Choose Frame Overlay</h3>
                </div>
                <button
                  onClick={() => setShowFrames(false)}
                  className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {framesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/60 text-xs">Loading available frames...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto">
                  <button
                    onClick={() => selectFrame(null)}
                    className="h-32 rounded-2xl border-2 border-dashed border-white/20 text-white/70 hover:border-white/40 font-bold text-sm flex flex-col items-center justify-center gap-2 bg-white/5"
                  >
                    <X className="w-6 h-6 text-white/40" />
                    No Frame
                  </button>
                  {frames.map((frame) => (
                    <button
                      key={frame.id}
                      onClick={() => selectFrame(frame.url)}
                      className={`relative h-32 rounded-2xl overflow-hidden border-2 transition-all group ${
                        branding?.frameUrl === frame.url
                          ? 'border-purple-400 ring-4 ring-purple-500/30'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={frame.url}
                        alt={frame.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs font-semibold py-1.5 px-3 truncate">
                        {frame.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {showEmailModal && event && currentPhoto && (
          <EmailCaptureModal
            eventId={event.id}
            photoId={currentPhoto.id}
            onClose={() => setShowEmailModal(false)}
          />
        )}

        {showLeadModal && (
          <LeadCaptureModal
            onContinue={() => {
              setShowLeadModal(false);
              setScreen('share');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
