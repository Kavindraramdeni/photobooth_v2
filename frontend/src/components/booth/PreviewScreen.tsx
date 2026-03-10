'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, Printer, Download, ArrowLeft, CheckCircle, Settings } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import { usePinchZoom } from '@/lib/usePinchZoom';
import { LeadCaptureModal } from '@/components/booth/LeadCaptureModal';
import { PrintLayoutModal } from '@/components/booth/PrintLayoutModal';
import { GreenScreenModal } from '@/components/booth/GreenScreenModal';
import toast from 'react-hot-toast';

async function iosCompatibleDownload(url: string, filename: string) {
  try {
    const res  = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href     = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  } catch {
    window.open(url, '_blank');
  }
}

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();
  const { scale, translateX, translateY, zoomHandlers, resetZoom, isZoomed } = usePinchZoom();
  const [showLeadModal, setShowLeadModal]   = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showGreenScreen, setShowGreenScreen] = useState(false);

  if (!currentPhoto) { setScreen('idle'); return null; }
  const photo = currentPhoto;

  const settings       = event?.settings;
  const primaryColor   = event?.branding?.primaryColor || '#7c3aed';
  const isGIF          = mode === 'gif' || mode === 'boomerang';
  const isStrip        = mode === 'strip';
  const modeLabel      = mode === 'boomerang' ? 'Boomerang' : mode === 'gif' ? 'GIF' : mode === 'strip' ? 'Strip' : 'Photo';
  const eventName      = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';
  // capturedFrames are the raw webcam base64 preview images (for strip multi-preview)
  const capturedFrames = (photo as any).capturedFrames as string[] | undefined;

  function handleShareClick() {
    if (event?.settings?.leadCapture) setShowLeadModal(true);
    else setScreen('share');
  }

  async function handleDownload() {
    const dateStr  = new Date().toISOString().split('T')[0];
    const ext      = isGIF ? 'gif' : 'jpg';
    const filename = `${eventName.replace(/\s+/g, '-')}-${dateStr}.${ext}`;
    await iosCompatibleDownload(photo.downloadUrl || photo.url, filename);
    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: photo.id });
    toast.success('Saved!');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('idle')} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Your {modeLabel}</h2>
          {event?.name && <p className="text-white/30 text-xs mt-0.5 hidden sm:block">{event.name}</p>}
        </div>
        <div className="w-10 sm:w-20" />
      </div>

      {/* Photo area */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden min-h-0 gap-3">

        {/* Strip multi-frame preview */}
        {isStrip && capturedFrames && capturedFrames.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 flex-wrap justify-center"
          >
            {capturedFrames.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt={`Frame ${i+1}`}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border-2 border-purple-500/50 shadow-md" />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">
                  {i+1}
                </div>
              </div>
            ))}
            <div className="w-full text-center text-white/30 text-xs mt-1">4-shot strip ↓ combined below</div>
          </motion.div>
        )}

        {/* Main photo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative w-full flex items-center justify-center flex-1 min-h-0"
        >
          <div {...zoomHandlers} className="w-full h-full flex items-center justify-center overflow-hidden"
            style={{ touchAction: isZoomed ? 'none' : 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Your photo"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{
                maxHeight: isStrip && capturedFrames && capturedFrames.length > 1 ? 'calc(100dvh - 380px)' : 'calc(100dvh - 260px)',
                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                transformOrigin: 'center center',
                transition: scale === 1 ? 'transform 0.3s ease' : 'none',
              }}
              draggable={false}
            />
          </div>

          {scale === 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-white/30 text-xs pointer-events-none select-none">
              Pinch to zoom
            </div>
          )}
          {isZoomed && (
            <button onClick={resetZoom} className="absolute top-3 left-3 bg-black/60 rounded-full px-3 py-1 text-white/70 text-xs font-medium">
              Reset
            </button>
          )}

          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring' }}
            className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Captured!</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="flex-shrink-0 px-4 sm:px-6 pb-5 sm:pb-8 pt-2 space-y-2.5 sm:space-y-3"
      >
        {/* Primary row */}
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

        {/* Secondary row */}
        <div className="grid gap-2" style={{
          gridTemplateColumns: `repeat(${[
            true,
            settings?.allowPrint !== false,
            !isGIF, // green screen only for photos
            settings?.allowRetakes !== false,
          ].filter(Boolean).length}, 1fr)`
        }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={handleDownload}
            className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
            <Download className="w-5 h-5" />
            <span className="text-xs font-medium">Save</span>
          </motion.button>

          {settings?.allowPrint !== false && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowPrintModal(true)}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <Printer className="w-5 h-5" />
              <span className="text-xs font-medium">Print</span>
            </motion.button>
          )}

          {!isGIF && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowGreenScreen(true)}
              className="flex flex-col items-center gap-1.5 py-3.5 sm:py-4 rounded-2xl bg-white/8 border border-white/15 text-white btn-touch hover:bg-white/12 transition-colors">
              <span className="text-lg">🟢</span>
              <span className="text-xs font-medium">BG</span>
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

      {/* Modals */}
      {showLeadModal && (
        <LeadCaptureModal onComplete={() => { setShowLeadModal(false); setScreen('share'); }} onSkip={() => { setShowLeadModal(false); setScreen('share'); }} />
      )}
      {showPrintModal && (
        <PrintLayoutModal photo={photo} eventName={eventName} primaryColor={primaryColor}
          onClose={() => setShowPrintModal(false)} />
      )}
      {showGreenScreen && (
        <GreenScreenModal photo={photo} onClose={() => setShowGreenScreen(false)} onApply={(newUrl) => {
          // Update current photo url with green-screen-removed version
          useBoothStore.getState().setCurrentPhoto({ ...photo, url: newUrl });
          setShowGreenScreen(false);
          toast.success('Background removed!');
        }} />
      )}
    </div>
  );
}
