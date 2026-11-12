'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wand2, Share2, CheckCircle2, Rocket, Printer, Image as ImageIcon, X, Mail, Sparkles, ChevronRight } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { EmailCaptureModal } from '@/components/booth/EmailCaptureModal';
import { TemplateRenderer } from '@/components/booth/TemplateRenderer';
import { useIsDemo } from '@/app/booth/BoothPageClient';
import toast from 'react-hot-toast';

// ── Print — single page, no blank pages ───────────────────────────────────────
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

// ── Tactile Arcade Action Button ─────────────────────────────────────────────
function ActionBtn({
  onClick, icon, label, gradient, glow, disabled = false, badge,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  gradient?: string;
  glow?: string;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      className="relative group flex flex-col items-center justify-center gap-1.5 rounded-2xl font-bold text-white text-xs select-none transition-all duration-200 disabled:opacity-40 min-h-[58px] sm:h-auto sm:py-3.5 px-3 min-w-[76px] sm:min-w-0 sm:w-full overflow-hidden glass-panel border border-white/10 hover:border-white/25"
      style={glow ? { boxShadow: `0 8px 24px -6px ${glow}` } : {}}
    >
      {badge && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-white/20 text-white/90">
          {badge}
        </span>
      )}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
          gradient ? `bg-gradient-to-br ${gradient}` : 'bg-white/10'
        } shadow-md`}
      >
        {icon}
      </div>
      <span className="leading-none text-center text-xs font-semibold tracking-tight text-white/90 group-hover:text-white">
        {label}
      </span>
    </motion.button>
  );
}

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession, setEvent, setCurrentPhoto } = useBoothStore();
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [framesLoading, setFramesLoading] = useState(false);
  const [frames, setFrames] = useState<Array<{ id: string; name: string; url: string; isDefault?: boolean; isActive?: boolean }>>([]);
  const isDemo = useIsDemo();

  useEffect(() => {
    if (!currentPhoto) setScreen('idle');
  }, [currentPhoto, setScreen]);

  if (!currentPhoto) return null;
  const photo = currentPhoto;

  const settings = event?.settings;
  const primaryColor = event?.branding?.primaryColor || '#8b5cf6';
  const isGIF = mode === 'gif' || mode === 'boomerang';
  const modeLabel = mode === 'boomerang' ? 'Boomerang' : mode === 'gif' ? 'GIF' : mode === 'strip' ? 'Photo Strip' : 'Portrait';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  function handleShareClick() {
    if (event?.settings?.leadCapture) setShowLeadModal(true);
    else setScreen('share');
  }

  const printScale = (event?.settings?.printScale as number) || 98;

  async function handlePrint() {
    if (!event) return;
    try {
      printPhotoOnly(photo.url, eventName, printScale);
      await trackAction(event.id, 'photo_printed', { photoId: photo.id });
      toast.success('Sent to printer! 🖨️');
    } catch { toast.error('Print failed — please check printer setup'); }
  }

  const autoPrinted = useRef(false);
  const [showEffects, setShowEffects] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');

  const EFFECTS = [
    { key: 'none',       label: 'Original',  style: 'none' },
    { key: 'bw',         label: 'B&W Glam',  style: 'grayscale(100%) contrast(115%)' },
    { key: 'warm',       label: 'Sunset',    style: 'sepia(45%) saturate(140%) brightness(105%)' },
    { key: 'cool',       label: 'Editorial', style: 'hue-rotate(190deg) saturate(110%) contrast(105%)' },
    { key: 'vivid',      label: 'Vibrant',   style: 'saturate(170%) contrast(110%)' },
    { key: 'fade',       label: 'Matte',     style: 'contrast(88%) brightness(110%) saturate(85%)' },
    { key: 'golden',     label: 'Golden Hour', style: 'sepia(70%) hue-rotate(-20deg) saturate(150%) brightness(106%)' },
  ];
  const currentFilter = EFFECTS.find(e => e.key === activeFilter)?.style || 'none';

  useEffect(() => {
    const autoPrint = event?.settings?.autoPrint as boolean | undefined;
    if (autoPrint && !autoPrinted.current && photo?.url && event) {
      autoPrinted.current = true;
      setTimeout(() => {
        printPhotoOnly(photo.url, eventName, printScale);
        trackAction(event.id, 'photo_printed', { photoId: photo.id, auto: true });
        toast.success('🖨️ Auto-printing...', { duration: 2500 });
      }, 800);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.error(e instanceof Error ? e.message : 'Failed to load frames');
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
    toast.success(frameUrl ? 'Frame overlay applied!' : 'Frame cleared');
  }

  const actions = [
    {
      id: 'share',
      icon: <Share2 className="w-5 h-5" />,
      label: 'Get Photo',
      gradient: 'from-purple-600 via-indigo-600 to-blue-600',
      glow: 'rgba(139, 92, 246, 0.5)',
      badge: 'QR / SMS',
      onClick: handleShareClick,
    },
    {
      id: 'effects',
      icon: <Wand2 className="w-5 h-5" />,
      label: 'Filters',
      gradient: 'from-amber-500 to-rose-500',
      glow: 'rgba(245, 158, 11, 0.4)',
      onClick: () => setShowEffects(v => !v),
    },
    ...(settings?.allowFrameOverlays ? [{
      id: 'frames',
      icon: <ImageIcon className="w-5 h-5" />,
      label: 'Frames',
      gradient: 'from-teal-500 to-emerald-600',
      glow: 'rgba(20, 184, 166, 0.4)',
      onClick: async () => {
        setShowFrames(true);
        if (frames.length === 0) await loadFrames();
      },
    }] : []),
    ...(settings?.allowEmailShare !== false ? [{
      id: 'email',
      icon: <Mail className="w-5 h-5" />,
      label: 'Email',
      gradient: 'from-emerald-600 to-green-700',
      glow: 'rgba(16, 185, 129, 0.4)',
      onClick: () => setShowEmailModal(true),
    }] : []),
    ...(settings?.allowPrint !== false ? [{
      id: 'print',
      icon: <Printer className="w-5 h-5" />,
      label: 'Print',
      gradient: undefined,
      glow: undefined,
      onClick: handlePrint,
    }] : []),
    ...(settings?.allowRetakes !== false ? [{
      id: 'retake',
      icon: <RefreshCw className="w-5 h-5" />,
      label: 'Retake',
      gradient: undefined,
      glow: undefined,
      onClick: () => setScreen('countdown'),
    }] : []),
  ];

  return (
    <div className="w-full h-full flex flex-col bg-transparent select-none overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/10 glass-crystal z-20">
        <button
          onClick={() => setScreen('idle')}
          className="text-slate-600 dark:text-white/60 hover:text-purple-600 dark:hover:text-white transition-colors text-xs font-bold px-3 py-1.5 rounded-xl glass-crystal-pill flex items-center gap-1 active:scale-95 shadow-sm"
        >
          ← Main Screen
        </button>
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-slate-900 dark:text-white font-black text-sm tracking-wide uppercase">Your {modeLabel}</h2>
          </div>
          {event?.name && <p className="text-slate-500 dark:text-white/40 text-[11px] font-bold truncate max-w-[200px]">{event.name}</p>}
        </div>
        <div className="w-20" />
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0 z-10 relative">
        {/* Photo Stage */}
        <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 min-h-0">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="relative w-full h-full flex items-center justify-center max-h-[58vh] sm:max-h-[70vh] lg:max-h-[76vh]"
          >
            <div
              className="relative inline-block max-h-full rounded-3xl overflow-hidden shadow-2xl border border-white/15"
              style={{ filter: currentFilter, transition: 'filter 0.3s ease' }}
            >
              <TemplateRenderer
                photoUrl={photo.url}
                eventName={eventName}
                template={{ layout: { footerText: event?.branding?.footerText, logoUrl: event?.branding?.logoUrl, borderColor: event?.branding?.secondaryColor } }}
              />

              {event?.branding?.frameUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={event.branding.frameUrl as string}
                  alt="Frame overlay"
                  className="absolute inset-0 w-full h-full object-cover rounded-3xl pointer-events-none select-none"
                  draggable={false}
                />
              )}
            </div>

            {/* Captured Success Badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white text-xs font-bold shadow-lg backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Perfect Shot</span>
            </motion.div>

            {/* Floating Retake Button in Landscape */}
            {settings?.allowRetakes !== false && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setScreen('countdown')}
                className="hidden sm:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5 group cursor-pointer z-20"
              >
                <div className="w-14 h-14 rounded-full glass-panel border border-white/20 flex items-center justify-center shadow-xl group-hover:border-purple-400 group-hover:bg-purple-600/30 transition-all duration-300">
                  <RefreshCw className="w-6 h-6 text-white group-hover:rotate-180 transition-transform duration-500" />
                </div>
                <span className="text-white/60 text-xs font-bold tracking-wide">Retake</span>
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Action Panel: Horizontal scroll on mobile, Vertical dock on desktop */}
        {/* Mobile Action Row */}
        <div className="flex sm:hidden flex-shrink-0 overflow-x-auto gap-2.5 px-4 py-3 glass-panel border-t border-white/10 scrollbar-none">
          {actions.map((a, i) => (
            <div key={a.id} className="flex-shrink-0">
              <ActionBtn
                onClick={a.onClick}
                icon={a.icon}
                label={a.label}
                gradient={a.gradient}
                glow={a.glow}
                badge={a.badge}
              />
            </div>
          ))}
        </div>

        {/* Desktop / Tablet Vertical Dock */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="hidden sm:flex flex-shrink-0 flex-col gap-3 py-6 px-4 border-l border-white/10 glass-panel overflow-y-auto w-36"
        >
          {actions.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
            >
              <ActionBtn
                onClick={a.onClick}
                icon={a.icon}
                label={a.label}
                gradient={a.gradient}
                glow={a.glow}
                badge={a.badge}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Filter Tray Modal Sheet */}
      <AnimatePresence>
        {showEffects && (
          <motion.div
            initial={{ y: 160, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 160, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute bottom-20 inset-x-4 z-40 glass-panel border border-white/15 rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-white font-bold text-sm">Select Color Grading Filter</span>
              </div>
              <button
                onClick={() => setShowEffects(false)}
                className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {EFFECTS.map(ef => (
                <button
                  key={ef.key}
                  onClick={() => setActiveFilter(ef.key)}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    activeFilter === ef.key
                      ? 'border-purple-400 bg-purple-500/20 shadow-[0_0_16px_rgba(168,85,247,0.4)]'
                      : 'border-white/10 glass-pill hover:border-white/25'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden relative shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={ef.label}
                      className="w-full h-full object-cover"
                      style={{ filter: ef.style }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white/80">{ef.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Bar: Done / Next Guest */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 glass-panel z-20 space-y-2">
        {isDemo && (
          <motion.a
            href="/signup"
            whileTap={{ scale: 0.98 }}
            className="block w-full rounded-2xl overflow-hidden shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7 50%,#ec4899)' }}
          >
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <Rocket className="w-5 h-5 text-white" />
                <div>
                  <p className="text-white font-bold text-xs leading-tight">Host this photobooth at your next event</p>
                  <p className="text-white/70 text-[10px]">Create an account in 30 seconds</p>
                </div>
              </div>
              <span className="bg-white text-purple-700 font-black text-xs px-3 py-1.5 rounded-xl">
                Get Started →
              </span>
            </div>
          </motion.a>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl font-black text-white text-base tracking-wide flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)` }}
        >
          <CheckCircle2 className="w-5 h-5" /> Done — Take Another Photo
        </motion.button>
      </div>

      {/* Frame Selection Modal */}
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
              className="w-full max-w-xl glass-panel border border-white/15 rounded-3xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-teal-400" />
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
                  <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/60 text-xs">Loading available frames...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto">
                  <button
                    onClick={() => selectFrame(null)}
                    className="h-32 rounded-2xl border-2 border-dashed border-white/20 text-white/70 hover:border-white/40 font-bold text-sm flex flex-col items-center justify-center gap-2 glass-pill"
                  >
                    <X className="w-6 h-6 text-white/40" />
                    No Frame
                  </button>
                  {frames.map(frame => (
                    <button
                      key={frame.id}
                      onClick={() => selectFrame(frame.url)}
                      className={`relative h-32 rounded-2xl overflow-hidden border-2 transition-all group ${
                        event?.branding?.frameUrl === frame.url ? 'border-purple-400 ring-4 ring-purple-500/30' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={frame.url} alt={frame.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-xs text-white text-xs font-semibold py-1.5 px-3 truncate">
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
          <EmailCaptureModal eventId={event.id} photoId={currentPhoto.id} onClose={() => setShowEmailModal(false)} />
        )}

        {showLeadModal && (
          <LeadCaptureModal
            onContinue={() => { setShowLeadModal(false); setScreen('share'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
