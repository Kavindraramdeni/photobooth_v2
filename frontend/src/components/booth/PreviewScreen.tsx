'use client';

import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, Printer, Download, ArrowLeft, CheckCircle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();

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
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setScreen('share')}
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
    </div>
  );
}
