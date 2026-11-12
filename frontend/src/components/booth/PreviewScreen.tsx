'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wand2, Share2, Printer, Image as ImageIcon, X, Mail, ArrowLeft, Check } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { EmailCaptureModal } from '@/components/booth/EmailCaptureModal';
import { TemplateRenderer } from '@/components/booth/TemplateRenderer';
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

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession, setEvent, setCurrentPhoto } = useBoothStore();
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [framesLoading, setFramesLoading] = useState(false);
  const [frames, setFrames] = useState<Array<{ id: string; name: string; url: string; isActive?: boolean }>>([]);
  const [showEffects, setShowEffects] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');

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

  if (!currentPhoto) return null;
  const photo = currentPhoto;

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = (branding?.primaryColor as string) || '#6366f1';
  const themeMode = (branding?.themeMode as string) || 'dark';
  const isLight = themeMode === 'light';
  const eventName = (branding?.eventName as string) || event?.name || 'SnapBooth';
  const printScale = (settings?.printScale as number) || 98;

  const EFFECTS = [
    { key: 'none', label: 'Original', style: 'none' },
    { key: 'bw', label: 'B&W Glam', style: 'grayscale(100%) contrast(115%)' },
    { key: 'warm', label: 'Sunset', style: 'sepia(45%) saturate(140%) brightness(105%)' },
    { key: 'cool', label: 'Editorial', style: 'hue-rotate(190deg) saturate(110%) contrast(105%)' },
    { key: 'vivid', label: 'Vibrant', style: 'saturate(170%) contrast(110%)' },
    { key: 'fade', label: 'Matte', style: 'contrast(88%) brightness(110%) saturate(85%)' },
    { key: 'golden', label: 'Golden Hour', style: 'sepia(70%) hue-rotate(-20deg) saturate(150%) brightness(106%)' },
  ];
  const currentFilter = EFFECTS.find(e => e.key === activeFilter)?.style || 'none';

  function handleDone() {
    if (settings?.leadCapture) {
      setShowLeadModal(true);
    } else {
      setScreen('share');
    }
  }

  async function handlePrint() {
    if (!event) return;
    try {
      printPhotoOnly(photo.url, eventName, printScale);
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

  // Circular progress calculations for 30s auto-reset ring
  const circleRadius = 18;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (circleCircumference * secondsLeft) / RESET_SECONDS;

  return (
    <div
      className="w-full h-full flex flex-col justify-between bg-transparent select-none overflow-hidden relative z-10"
      onClick={restartAutoResetTimer}
      onTouchStart={restartAutoResetTimer}
    >
      {/* Top Header: Clean, Solid, Auto-Reset Ring */}
      <div
        className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b-2 z-20 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#181938] border-slate-800 text-white'
        }`}
      >
        <button
          onClick={() => setScreen('style')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Style</span>
        </button>

        {/* Event Title */}
        <h2 className="text-base sm:text-lg font-black tracking-tight truncate max-w-xs sm:max-w-md">
          {eventName}
        </h2>

        {/* Auto-Reset 30s Countdown Ring */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Auto-reset
          </span>
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r={circleRadius}
                className={isLight ? 'stroke-slate-200' : 'stroke-slate-800'}
                strokeWidth="3"
                fill="transparent"
              />
              <circle
                cx="20"
                cy="20"
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
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black">
              {secondsLeft}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Preview Frame & Side Action Stack */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 sm:p-8 gap-6 min-h-0 overflow-hidden">
        {/* Photo Stage (Solid framed container, no marketing banner, no perfect shot badge) */}
        <div className="relative flex-1 flex items-center justify-center w-full h-full max-h-[62vh] sm:max-h-[72vh]">
          <div
            className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 max-h-full ${
              isLight ? 'bg-white border-white shadow-slate-300' : 'bg-[#181938] border-slate-700 shadow-black/60'
            }`}
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
                className="absolute inset-0 w-full h-full object-cover rounded-3xl pointer-events-none select-none"
                draggable={false}
              />
            )}
          </div>
        </div>

        {/* Solid Action Buttons Stack */}
        <div className="flex md:flex-col gap-3 w-full md:w-48 flex-shrink-0 justify-center">
          {/* Retake Button (if allowed) */}
          {settings?.allowRetakes !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen('countdown')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm border-2 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#181938] hover:bg-[#22244c] border-slate-700 text-white'
              }`}
            >
              <RefreshCw className="w-5 h-5 text-indigo-400" />
              <span>Retake</span>
            </motion.button>
          )}

          {/* Color Grading Filters */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEffects(v => !v)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm border-2 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-[#181938] hover:bg-[#22244c] border-slate-700 text-white'
            }`}
          >
            <Wand2 className="w-5 h-5 text-amber-400" />
            <span>Filters</span>
          </motion.button>

          {/* Frame Overlays (if enabled) */}
          {settings?.allowFrameOverlays && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                setShowFrames(true);
                if (frames.length === 0) await loadFrames();
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm border-2 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#181938] hover:bg-[#22244c] border-slate-700 text-white'
              }`}
            >
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              <span>Frames</span>
            </motion.button>
          )}

          {/* Direct Print Button (only when allowed and available) */}
          {settings?.allowPrint !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm border-2 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#181938] hover:bg-[#22244c] border-slate-700 text-white'
              }`}
            >
              <Printer className="w-5 h-5 text-sky-400" />
              <span>Print</span>
            </motion.button>
          )}

          {/* Direct Email (if enabled) */}
          {settings?.allowEmailShare !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEmailModal(true)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm border-2 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#181938] hover:bg-[#22244c] border-slate-700 text-white'
              }`}
            >
              <Mail className="w-5 h-5 text-rose-400" />
              <span>Email</span>
            </motion.button>
          )}
        </div>
      </div>

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
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Select Photo Filter
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
                      ? 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      : 'border-slate-700/80 hover:border-slate-600 bg-black/20'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={ef.label}
                      className="w-full h-full object-cover"
                      style={{ filter: ef.style }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {ef.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Bar: Done is a FULL-WIDTH, SOLID ACCENT BUTTON and the MOST PROMINENT THING on screen */}
      <div
        className={`flex-shrink-0 p-6 border-t-2 z-20 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#181938] border-slate-800'
        }`}
      >
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDone}
          className="w-full py-5 sm:py-6 rounded-2xl font-black text-xl sm:text-2xl text-white tracking-wide flex items-center justify-center gap-3 shadow-2xl cursor-pointer border-2 border-white/20 active:scale-95 transition-all"
          style={{ backgroundColor: primaryColor }}
        >
          <Check className="w-7 h-7 stroke-[3]" />
          <span>Done — Get Photo &amp; Share</span>
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
