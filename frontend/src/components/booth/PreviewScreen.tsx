'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, CheckCircle, Rocket, Printer } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { useIsDemo } from '@/app/booth/BoothPageClient';
import toast from 'react-hot-toast';

// ── Print fix — single page only, no blank pages ──────────────────────────────
// Key fixes:
// 1. overflow:hidden on html/body stops extra blank pages
// 2. height:auto on img prevents page overflow
// 3. page-break-after:avoid on all elements
// 4. Single @page rule with exact paper size
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

  doc.open();
  doc.close();

  const style = doc.createElement('style');
  style.textContent = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    // overflow:hidden is the key fix — prevents blank second/third page
    'html, body { width:100%; height:100%; overflow:hidden; background:#fff; }',
    '@page { margin:0; size:4in 6in portrait; }',
    '@media print {',
    '  html, body { height:auto; overflow:hidden; }',
    '  * { page-break-after:avoid !important; page-break-before:avoid !important; page-break-inside:avoid !important; }',
    '  img { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
    '}',
    '.wrap { display:flex; flex-direction:column; align-items:center; justify-content:flex-start;',
    '        width:4in; height:6in; overflow:hidden; padding:0.15in; gap:0.08in; }',
    'img { width:100%; height:auto; max-height:5.4in; object-fit:contain; display:block; }',
    '.footer { font-size:8pt; color:#555; text-align:center; line-height:1.3; }',
    '.event-name { font-size:9pt; font-weight:bold; color:#333; }',
  ].join(' ');
  doc.head.appendChild(style);

  const wrap = doc.createElement('div');
  wrap.className = 'wrap';

  const img = doc.createElement('img');
  img.src = photoUrl;
  img.alt = 'photo';
  wrap.appendChild(img);

  const nameEl = doc.createElement('p');
  nameEl.className = 'event-name';
  nameEl.textContent = eventName;
  wrap.appendChild(nameEl);

  const footer = doc.createElement('p');
  footer.className = 'footer';
  footer.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  wrap.appendChild(footer);

  doc.body.appendChild(wrap);

  function doPrint() { win!.focus(); win!.print(); }
  if (img.complete) { setTimeout(doPrint, 400); }
  else { img.onload = () => setTimeout(doPrint, 400); }

  setTimeout(() => { document.getElementById('__snapbooth_print_frame')?.remove(); }, 30000);
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
    if (event?.settings?.leadCapture) {
      setShowLeadModal(true);
    } else {
      setScreen('share');
    }
  }

  async function handlePrint() {
    if (!event) return;
    try {
      printPhotoOnly(photo.url, eventName);
      await trackAction(event.id, 'photo_printed', { photoId: photo.id });
      toast.success('Sent to printer!');
    } catch { toast.error('Print failed — try again'); }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('idle')}
          className="text-white/50 hover:text-white transition-colors text-sm px-2 py-1">
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base">Your {modeLabel}</h2>
          {event?.name && <p className="text-white/30 text-xs">{event.name}</p>}
        </div>
        <div className="w-16" />
      </div>

      {/* ── Main layout: Photo left 3/4 + Actions right 1/4 ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT — Photo (3/4) */}
        <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Your photo"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{ maxHeight: 'calc(100dvh - 160px)' }}
              draggable={false}
            />

            {/* Captured badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Captured!</span>
            </motion.div>
          </motion.div>

          {/* ── Retake circle button — centre bottom of photo area ── */}
          {settings?.allowRetakes !== false && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setScreen('countdown')}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 group"
            >
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center group-hover:bg-white/20 transition-all shadow-xl backdrop-blur-sm">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/50 text-xs font-medium">Retake</span>
            </motion.button>
          )}
        </div>

        {/* RIGHT — Actions panel (1/4, min 120px) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="w-28 sm:w-36 flex-shrink-0 flex flex-col gap-3 py-4 px-2 border-l border-white/8 bg-[#0d0d18]/60 overflow-y-auto"
        >
          {/* AI Filter */}
          {settings?.allowAI !== false && !isGIF && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen('ai')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-white text-xs btn-touch"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
            >
              <Sparkles className="w-6 h-6" />
              <span>AI Filter</span>
            </motion.button>
          )}

          {/* Share & QR — primary action */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleShareClick}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-white text-xs btn-touch bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            <Share2 className="w-6 h-6" />
            <span>Share & QR</span>
          </motion.button>

          {/* Print */}
          {settings?.allowPrint !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-white text-xs btn-touch bg-white/8 border border-white/15 hover:bg-white/12 transition-colors"
            >
              <Printer className="w-6 h-6" />
              <span>Print</span>
            </motion.button>
          )}

          {/* Stickers placeholder — future feature */}
          <div className="flex flex-col items-center gap-2 py-4 rounded-2xl text-white/20 text-xs border border-white/5 border-dashed">
            <span className="text-xl">🎨</span>
            <span>Effects</span>
            <span className="text-[9px] opacity-60">Coming soon</span>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t border-white/8 bg-[#0d0d18]/40 space-y-2">

        {/* Demo CTA */}
        {isDemo && (
          <motion.a
            href="/signup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.98 }}
            className="block w-full rounded-2xl overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)' }}
          >
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-white flex-shrink-0" />
                <div>
                  <p className="text-white font-bold text-xs leading-tight">Love it? This is YOUR booth.</p>
                  <p className="text-white/75 text-[10px]">Start free — no card needed</p>
                </div>
              </div>
              <div className="flex-shrink-0 bg-white text-purple-700 font-bold text-xs px-2.5 py-1 rounded-lg ml-2">
                Try Free →
              </div>
            </div>
          </motion.a>
        )}

        {/* Done — Take Another — centered */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}bb)` }}
        >
          ✅ Done — Take Another
        </motion.button>
      </div>

      {/* Lead modal */}
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
