'use client';

import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, Printer, Download, ArrowLeft } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import Image from 'next/image';
import toast from 'react-hot-toast';

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();

  if (!currentPhoto) {
    setScreen('idle');
    return null;
  }

  const settings = event?.settings;
  const isGIF = mode === 'gif' || mode === 'boomerang';

  async function handlePrint() {
    if (!currentPhoto || !event) return;
    await trackAction(event.id, 'photo_printed', { photoId: currentPhoto.id });
    window.print();
    toast.success('Sent to printer!');
  }

  async function handleDownload() {
    if (!currentPhoto) return;
    const a = document.createElement('a');
    a.href = currentPhoto.downloadUrl;
    a.download = `snapbooth_${Date.now()}.${isGIF ? 'gif' : 'jpg'}`;
    a.click();

    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button
          onClick={() => setScreen('idle')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-semibold">Your {isGIF ? (mode === 'boomerang' ? 'Boomerang' : 'GIF') : 'Photo'}</h2>
        <div className="w-16" />
      </div>

      {/* Photo preview */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="photo-card max-h-full max-w-full"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto.url}
            alt="Your photo"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          />
        </motion.div>
      </div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 pb-6 space-y-3"
      >
        {/* Share + AI row */}
        <div className="grid grid-cols-2 gap-3">
          {settings?.allowAI !== false && !isGIF && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen('ai')}
              className="flex items-center justify-center gap-3 py-5 rounded-2xl font-semibold
                         text-white btn-touch glow-purple"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <Sparkles className="w-6 h-6" />
              <span>AI Magic ✨</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setScreen('share')}
            className="flex items-center justify-center gap-3 py-5 rounded-2xl font-semibold
                       bg-blue-600 hover:bg-blue-500 text-white btn-touch col-span-1"
            style={settings?.allowAI === false || isGIF ? { gridColumn: 'span 2' } : {}}
          >
            <Share2 className="w-6 h-6" />
            <span>Share & QR Code</span>
          </motion.button>
        </div>

        {/* Print + Retake + New row */}
        <div className="grid grid-cols-3 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl
                       bg-white/10 border border-white/20 text-white btn-touch"
          >
            <Download className="w-5 h-5" />
            <span className="text-xs">Download</span>
          </motion.button>

          {settings?.allowPrint !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl
                         bg-white/10 border border-white/20 text-white btn-touch"
            >
              <Printer className="w-5 h-5" />
              <span className="text-xs">Print</span>
            </motion.button>
          )}

          {settings?.allowRetakes !== false && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen('countdown')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl
                         bg-white/10 border border-white/20 text-white btn-touch"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-xs">Retake</span>
            </motion.button>
          )}
        </div>

        {/* Done button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60
                     hover:text-white hover:bg-white/10 transition-all btn-touch text-sm"
        >
          Done — Take another →
        </motion.button>
      </motion.div>
    </div>
  );
}
