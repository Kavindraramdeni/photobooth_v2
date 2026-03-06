'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, Printer, Download, ArrowLeft, CheckCircle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { usePinchZoom } from '@/lib/usePinchZoom';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import toast from 'react-hot-toast';

// ── iOS-safe download ─────────────────────────────────────────────────────
// Plain <a download> silently fails on iOS Safari — opens new tab instead.
// Fetching as blob + objectURL works on Android & desktop.
// On iOS it still opens in Safari viewer — user long-presses → Save to Photos.
async function iosCompatibleDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  } catch {
    // Fallback: open in new tab — user can long-press → Save on iOS
    window.open(url, '_blank');
  }
}

// ── Photo-only print via hidden iframe (DOM API — no template literals) ──────
// Uses DOM createElement instead of doc.write() to avoid TSX parser issues.
// Includes proper @page DPI hints for 4x6 photo prints.
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

  // Build print stylesheet via DOM — safe in TSX, no template literal HTML
  const style = doc.createElement('style');
  const css = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'html,body { width:100%; height:100%; background:#fff; }',
    // 4x6 portrait with 300dpi hint — most photo printers
    '@page { margin:0.3cm; size:4in 6in portrait; }',
    '@media print {',
    '  .wrap { page-break-inside:avoid; }',
    '  img { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
    '}',
    '.wrap { display:flex; flex-direction:column; align-items:center;',
    '        justify-content:center; min-height:100vh; padding:8px; gap:6px; }',
    'img { width:100%; max-height:90vh; object-fit:contain; display:block; }',
    '.footer { font-size:9pt; color:#555; text-align:center; }',
    '.event-name { font-size:10pt; font-weight:bold; color:#333; }',
  ].join(' ');
  style.textContent = css;
  doc.head.appendChild(style);

  // Build body
  const wrap = doc.createElement('div');
  wrap.className = 'wrap';

  const img = doc.createElement('img');
  img.src = photoUrl;
  img.alt = 'photo';
  wrap.appendChild(img);

  const eventNameEl = doc.createElement('p');
  eventNameEl.className = 'event-name';
  eventNameEl.textContent = eventName;
  wrap.appendChild(eventNameEl);

  const footer = doc.createElement('p');
  footer.className = 'footer';
  footer.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  wrap.appendChild(footer);

  doc.body.appendChild(wrap);

  function doPrint() { win!.focus(); win!.print(); }
  if (img.complete) { setTimeout(doPrint, 300); }
  else { img.onload = () => setTimeout(doPrint, 300); }

  setTimeout(() => { document.getElementById('__snapbooth_print_frame')?.remove(); }, 30000);
}

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();
  const { scale, translateX, translateY, zoomHandlers, resetZoom, isZoomed } = usePinchZoom();
  const [showLeadModal, setShowLeadModal] = useState(false);

  if (!currentPhoto) { setScreen('idle'); return null; }

  const settings = event?.settings;
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const isGIF = mode === 'gif' || mode === 'boomerang';
  const modeLabel = mode === 'boomerang' ? 'Boomerang' : mode === 'gif' ? 'GIF' : mode === 'strip' ? 'Strip' : 'Photo';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  // If leadCapture is enabled, show the modal first; otherwise go straight to share
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
      printPhotoOnly(currentPhoto.url, eventName);
      await trackAction(event.id, 'photo_printed', { photoId: currentPhoto.id });
      toast.success('Sent to printer!');
    } catch { toast.error('Print failed — try again'); }
  }

  async function handleDownload() {
    // Meaningful filename: EventName-YYYY-MM-DD.jpg  (not UUID timestamp blob)
    const dateStr = new Date().toISOString().split('T')[0];
    const ext = isGIF ? 'gif' : 'jpg';
    const filename = `${eventName.replace(/\s+/g, '-')}-${dateStr}.${ext}`;
    await iosCompatibleDownload(currentPhoto.downloadUrl || currentPhoto.url, filename);
    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
    toast.success('Saved! On iPhone: long-press → Save to Photos');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('idle')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Your {modeLabel}</h2>
          {event?.name && <p className="text-white/30 text-xs mt-0.5 hidden sm:block">{event.name}</p>}
        </div>
        <div className="w-10 sm:w-20" />
      </div>

      {/* ── Photo ── */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden min-h-0">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative w-full h-full flex items-center justify-center"
        >
          {/* Pinch-to-zoom wrapper */}
          <div
            {...zoomHandlers}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            style={{ touchAction: isZoomed ? 'none' : 'auto' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentPhoto.url} alt="Your photo"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{
                maxHeight: 'calc(100dvh - 260px)',
                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                transformOrigin: 'center center',
                transition: scale === 1 ? 'transform 0.3s ease' : 'none',
              }}
              draggable={false}
            />
          </div>

          {/* Pinch hint */}
          {scale === 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-white/30 text-xs pointer-events-none select-none">
              Pinch to zoom
            </div>
          )}
          {isZoomed && (
            <button onClick={resetZoom}
              className="absolute top-3 left-3 bg-black/60 rounded-full px-3 py-1 text-white/70 text-xs font-medium">
              Reset
            </button>
          )}

          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Captured!</span>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="flex-shrink-0 px-4 sm:px-6 pb-5 sm:pb-8 pt-2 space-y-2.5 sm:space-y-3"
      >
        {/* Primary row: AI + Share */}
        <div className="grid gap-2.5"
          style={{ gridTemplateColumns: settings?.allowAI !== false && !isGIF ? '1fr 1fr' : '1fr' }}>
          {settings?.allowAI !== false && !isGIF && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setScreen('ai')}
              className="flex items-center justify-center gap-2.5 py-4 sm:py-5 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>AI Filter ✨</span>
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleShareClick}
            className="flex items-center justify-center gap-2.5 py-4 sm:py-5 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch bg-blue-600 hover:bg-blue-500 transition-colors">
            <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Share &amp; QR</span>
          </motion.button>
        </div>

        {/* Secondary row: Save / Print / Retake */}
        <div className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${[true, settings?.allowPrint !== false, settings?.allowRetakes !== false].filter(Boolean).length}, 1fr)` }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={handleDownload}
            className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
            <Download className="w-5 h-5" />
            <span className="text-xs font-medium">Save</span>
          </motion.button>

          {settings?.allowPrint !== false && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={handlePrint}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <Printer className="w-5 h-5" />
              <span className="text-xs font-medium">Print</span>
            </motion.button>
          )}

          {settings?.allowRetakes !== false && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setScreen('countdown')}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <RefreshCw className="w-5 h-5" />
              <span className="text-xs font-medium">Retake</span>
            </motion.button>
          )}
        </div>

        {/* Done */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}bb)` }}>
          ✅ Done — Take Another
        </motion.button>
      </motion.div>
    </div>
  );
}

  if (!currentPhoto) { setScreen('idle'); return null; }

  const settings = event?.settings;
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const isGIF = mode === 'gif' || mode === 'boomerang';
  const modeLabel = mode === 'boomerang' ? 'Boomerang' : mode === 'gif' ? 'GIF' : mode === 'strip' ? 'Strip' : 'Photo';

  async function handlePrint() {
    if (!event) return;
    await trackAction(event.id, 'photo_printed', { photoId: currentPhoto.id });
    window.print();
    toast.success('Sent to printer!');
  }

  async function handleDownload() {
    const a = document.createElement('a');
    a.href = currentPhoto.downloadUrl;
    a.download = `snapbooth_${Date.now()}.${isGIF ? 'gif' : 'jpg'}`;
    a.click();
    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
    toast.success('Saved!');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('idle')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Your {modeLabel}</h2>
          {event?.name && <p className="text-white/30 text-xs mt-0.5 hidden sm:block">{event.name}</p>}
        </div>
        {/* spacer matches back button width */}
        <div className="w-10 sm:w-20" />
      </div>

      {/* ── Photo ── */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden min-h-0">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative w-full h-full flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto.url}
            alt="Your photo"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            style={{ maxHeight: 'calc(100dvh - 260px)' }}
          />
          {/* Success badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Captured!</span>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex-shrink-0 px-4 sm:px-6 pb-5 sm:pb-8 pt-2 space-y-2.5 sm:space-y-3"
      >
        {/* Primary row: Share + AI */}
        <div className="grid gap-2.5"
          style={{ gridTemplateColumns: settings?.allowAI !== false && !isGIF ? '1fr 1fr' : '1fr' }}>
          {settings?.allowAI !== false && !isGIF && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setScreen('ai')}
              className="flex items-center justify-center gap-2.5 py-4 sm:py-5 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>AI Magic ✨</span>
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleShareClick}
            className="flex items-center justify-center gap-2.5 py-4 sm:py-5 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch bg-blue-600 hover:bg-blue-500 transition-colors">
            <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Share & QR Code</span>
          </motion.button>
        </div>

        {/* Secondary row: Download / Print / Retake */}
        <div className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${[true, settings?.allowPrint !== false, settings?.allowRetakes !== false].filter(Boolean).length}, 1fr)` }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={handleDownload}
            className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
            <Download className="w-5 h-5" />
            <span className="text-xs font-medium">Save</span>
          </motion.button>
          {settings?.allowPrint !== false && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={handlePrint}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <Printer className="w-5 h-5" />
              <span className="text-xs font-medium">Print</span>
            </motion.button>
          )}
          {settings?.allowRetakes !== false && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setScreen('countdown')}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <RefreshCw className="w-5 h-5" />
              <span className="text-xs font-medium">Retake</span>
            </motion.button>
          )}
        </div>

        {/* Done */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}bb)` }}>
          ✅ Done — Take Another
        </motion.button>
      </motion.div>

      {/* Lead capture modal — shown before share if leadCapture enabled */}
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
