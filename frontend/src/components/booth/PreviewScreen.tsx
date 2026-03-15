'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, CheckCircle, Rocket, Printer } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { useIsDemo } from '@/app/booth/BoothPageClient';
import toast from 'react-hot-toast';

// ── Print — single page, no blank pages ───────────────────────────────────────
function printPhotoOnly(photoUrl: string, eventName: string) {
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
  const img = doc.createElement('img'); img.src = photoUrl; img.alt = 'photo';
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

// ── Action button — used in both portrait row and landscape panel ─────────────
function ActionBtn({
  onClick, icon, label, color, accent = false, disabled = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color?: string;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl font-bold text-white text-xs select-none transition-colors active:opacity-80 disabled:opacity-40 h-16 sm:h-auto sm:py-4 px-2 sm:px-3 min-w-[64px] sm:min-w-0 sm:w-full"
      style={color ? { background: color } : accent
        ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }
        : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }
      }
    >
      <span className="w-6 h-6 flex items-center justify-center">{icon}</span>
      <span className="leading-none text-center">{label}</span>
    </motion.button>
  );
}

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();
  const [showLeadModal, setShowLeadModal] = useState(false);
  const isDemo = useIsDemo();

  if (!currentPhoto) { setScreen('idle'); return null; }
  const photo = currentPhoto;

  const settings = event?.settings;
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const isGIF = mode === 'gif' || mode === 'boomerang';
  const modeLabel = mode === 'boomerang' ? 'Boomerang' : mode === 'gif' ? 'GIF' : mode === 'strip' ? 'Strip' : 'Photo';
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
      toast.success('Sent to printer!');
    } catch { toast.error('Print failed — try again'); }
  }

  // ── Auto-print: fires once on mount if operator enabled it ─────────────────
  const autoPrinted = useRef(false);
  useEffect(() => {
    const autoPrint = event?.settings?.autoPrint as boolean | undefined;
    if (autoPrint && !autoPrinted.current && photo?.url && event) {
      autoPrinted.current = true;
      // Small delay so the photo renders first
      setTimeout(() => {
        printPhotoOnly(photo.url, eventName, printScale);
        trackAction(event.id, 'photo_printed', { photoId: photo.id, auto: true });
        toast.success('🖨️ Auto-printing...', { duration: 2000 });
      }, 800);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build action list dynamically
  const actions = [
    ...(settings?.allowAI !== false && !isGIF ? [{
      id: 'ai', icon: <Sparkles className="w-5 h-5" />, label: 'AI Filter',
      color: 'linear-gradient(135deg,#7c3aed,#a855f7)', onClick: () => setScreen('ai'),
    }] : []),
    {
      id: 'share', icon: <Share2 className="w-5 h-5" />, label: 'Share & QR',
      color: '#2563eb', onClick: handleShareClick,
    },
    ...(settings?.allowPrint !== false ? [{
      id: 'print', icon: <Printer className="w-5 h-5" />, label: 'Print',
      color: undefined, onClick: handlePrint,
    }] : []),
    ...(settings?.allowRetakes !== false ? [{
      id: 'retake', icon: <RefreshCw className="w-5 h-5" />, label: 'Retake',
      color: undefined, onClick: () => setScreen('countdown'),
    }] : []),
  ];

  return (
    <div className="w-full h-full flex flex-col bg-[#080810] select-none overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3
                      border-b border-white/[0.07] bg-[#0d0d1a]">
        <button
          onClick={() => setScreen('idle')}
          className="text-white/40 hover:text-white/80 transition-colors text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-white/5"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base leading-tight">Your {modeLabel}</h2>
          {event?.name && <p className="text-white/25 text-[11px] mt-0.5">{event.name}</p>}
        </div>
        <div className="w-16" />
      </div>

      {/* ── Body — responsive split ─────────────────────────────────────────
           Portrait  (< sm): flex-col  — photo top, actions bottom row
           Landscape (≥ sm): flex-row  — photo left, actions right panel
      ── */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">

        {/* ── PHOTO AREA ─────────────────────────────────────────────────── */}
        <div className="
          relative flex items-center justify-center overflow-hidden
          /* portrait: 55% height, no padding top */ 
          flex-[0_0_55%] sm:flex-1
          p-3 sm:p-4
        ">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Your photo"
              className="max-h-full object-contain rounded-2xl shadow-2xl"
              style={{
                maxWidth: mode === 'strip' ? '320px' : '100%',
                width: mode === 'strip' ? 'auto' : '100%',
              }}
              draggable={false}
            />

            {/* ✅ Captured badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: 'spring' }}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Captured!</span>
            </motion.div>

            {/* Retake circle — landscape only, floats bottom-center of photo */}
            {settings?.allowRetakes !== false && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => setScreen('countdown')}
                className="
                  hidden sm:flex /* landscape only — portrait has it in actions row */
                  absolute bottom-5 left-1/2 -translate-x-1/2
                  flex-col items-center gap-1 group
                "
              >
                <div className="w-14 h-14 rounded-full bg-black/40 border-2 border-white/30
                                flex items-center justify-center backdrop-blur-md
                                group-hover:bg-black/60 group-hover:border-white/50 transition-all shadow-xl">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/50 text-[11px] font-medium">Retake</span>
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* ── ACTIONS ────────────────────────────────────────────────────────
             Portrait:  horizontal scrollable row at the bottom of photo section
             Landscape: fixed-width vertical panel on the right
        ── */}

        {/* PORTRAIT row (hidden on sm+) */}
        <div className="
          flex sm:hidden
          flex-shrink-0 overflow-x-auto overflow-y-hidden
          gap-2 px-3 py-2
          border-t border-white/[0.06] bg-[#0d0d1a]/70
          scrollbar-none
        "
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {actions.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="flex-shrink-0"
            >
              <ActionBtn
                onClick={a.onClick}
                icon={a.icon}
                label={a.label}
                color={a.color}
              />
            </motion.div>
          ))}
        </div>

        {/* LANDSCAPE panel (hidden on mobile, shown on sm+) */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="hidden sm:flex flex-shrink-0 flex-col gap-2.5 py-4 px-2.5 border-l border-white/[0.06] bg-[#0d0d1a]/60 overflow-y-auto"
          style={{ width: '140px', minWidth: '140px' }}
        >
          {actions.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
            >
              <ActionBtn
                onClick={a.onClick}
                icon={a.icon}
                label={a.label}
                color={a.color}
              />
            </motion.div>
          ))}

          {/* Effects — coming soon */}
          <div className="flex flex-col items-center gap-1.5 py-4 rounded-2xl
                          text-white/15 text-xs border border-white/[0.06] border-dashed mt-auto">
            <span className="text-lg">🎨</span>
            <span>Effects</span>
            <span className="text-[9px] opacity-70">Soon</span>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-safe-or-5 pt-2
                      border-t border-white/[0.06] bg-[#0d0d1a]/50 space-y-2"
           style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>

        {/* Demo CTA */}
        {isDemo && (
          <motion.a
            href="/signup"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.98 }}
            className="block w-full rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7 50%,#ec4899)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Rocket className="w-5 h-5 text-white flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-bold text-xs leading-tight truncate">Love it? This is YOUR booth.</p>
                  <p className="text-white/70 text-[10px] truncate">Free trial — no card needed</p>
                </div>
              </div>
              <span className="flex-shrink-0 bg-white text-purple-700 font-black text-xs px-3 py-1.5 rounded-lg">
                Try Free →
              </span>
            </div>
          </motion.a>
        )}

        {/* Done — centred, full width */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:opacity-80"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}cc)` }}
        >
          ✅ Done — Take Another
        </motion.button>
      </div>

      {/* Lead capture modal */}
      <AnimatePresence>
        {showLeadModal && (
          <LeadCaptureModal
            onContinue={() => { setShowLeadModal(false); setScreen('share'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
