'use client';

import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Share2, Printer, Download, ArrowLeft } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

export function PreviewScreen() {
  const { currentPhoto, event, mode, setScreen, resetSession } = useBoothStore();
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!currentPhoto) {
    setScreen('idle');
    return null;
  }

  const settings = event?.settings;
  const isGIF = mode === 'gif' || mode === 'boomerang';
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = event?.branding?.eventName || event?.name || 'SnapBooth';

  // ─── SAVE TO DEVICE (iPad Camera Roll) ────────────────────────────────────
  async function handleSaveToDevice() {
    if (!currentPhoto || saving) return;
    setSaving(true);

    try {
      // Try Web Share API first (iOS Safari) — shares to Photos app
      if (navigator.share && navigator.canShare) {
        try {
          const response = await fetch(currentPhoto.downloadUrl);
          const blob = await response.blob();
          const ext = isGIF ? 'gif' : 'jpg';
          const file = new File([blob], `snapbooth_${Date.now()}.${ext}`, {
            type: isGIF ? 'image/gif' : 'image/jpeg',
          });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `My photo from ${eventName}`,
            });
            if (event) await trackAction(event.id, 'photo_saved', { photoId: currentPhoto.id });
            toast.success('Saved to your device! 📱');
            setSaving(false);
            return;
          }
        } catch (shareErr: unknown) {
          // User cancelled or share failed, fall through to download
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            setSaving(false);
            return;
          }
        }
      }

      // Fallback: trigger download (works on all browsers)
      const a = document.createElement('a');
      a.href = currentPhoto.downloadUrl;
      a.download = `snapbooth_${eventName.replace(/\s+/g, '_')}_${Date.now()}.${isGIF ? 'gif' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
      toast.success('Photo downloaded! 📥');
    } catch (err) {
      toast.error('Could not save photo. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── PRINT (AirPrint / thermal printer) ──────────────────────────────────
  async function handlePrint() {
    if (!currentPhoto || !event || printing) return;
    setPrinting(true);

    // Set the print photo URL in a global so the print CSS can use it
    (window as any).__printPhotoUrl = currentPhoto.downloadUrl;
    (window as any).__printEventName = eventName;
    (window as any).__printDate = (event as any).date || new Date().toLocaleDateString();

    await trackAction(event.id, 'photo_printed', { photoId: currentPhoto.id });

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);

    toast.success('Sending to printer... 🖨️');
  }

  return (
    <>
      {/* ── PRINT LAYOUT (only visible when printing) ─────────────────── */}
      <div id="print-layout" className="hidden">
        <div className="print-photo-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto.url}
            alt="Your photo"
            className="print-photo"
          />
          <div className="print-footer">
            <span className="print-event-name">{eventName}</span>
            {event?.settings && (
              <span className="print-date">{(event as any).date || new Date().toLocaleDateString()}</span>
            )}
            <span className="print-branding">SnapBooth AI ✨</span>
          </div>
        </div>
      </div>

      {/* ── MAIN PREVIEW UI ───────────────────────────────────────────── */}
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
          <h2 className="text-white font-semibold">
            Your {isGIF ? (mode === 'boomerang' ? 'Boomerang' : 'GIF') : 'Photo'} 🎉
          </h2>
          <div className="w-16" />
        </div>

        {/* Photo preview */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="photo-card max-h-full max-w-full"
            style={{ maxHeight: 'calc(100vh - 300px)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto.url}
              alt="Your photo"
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(100vh - 300px)' }}
            />
          </motion.div>
        </div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 pb-4 space-y-3"
        >
          {/* Primary row: AI + Share */}
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
                         bg-blue-600 hover:bg-blue-500 text-white btn-touch"
              style={settings?.allowAI === false || isGIF ? { gridColumn: 'span 2' } : {}}
            >
              <Share2 className="w-6 h-6" />
              <span>Share &amp; QR Code</span>
            </motion.button>
          </div>

          {/* Secondary row: Save + Print + Retake */}
          <div className={`grid gap-3 ${settings?.allowPrint !== false ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* Save to device */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveToDevice}
              disabled={saving}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl
                         bg-white/10 border border-white/20 text-white btn-touch
                         disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span className="text-xs">{saving ? 'Saving...' : 'Save Photo'}</span>
            </motion.button>

            {/* Print */}
            {settings?.allowPrint !== false && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePrint}
                disabled={printing}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl
                           bg-white/10 border border-white/20 text-white btn-touch
                           disabled:opacity-50"
              >
                {printing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
                <span className="text-xs">{printing ? 'Printing...' : 'Print'}</span>
              </motion.button>
            )}

            {/* Retake */}
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

          {/* Done */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetSession}
            className="w-full py-5 rounded-2xl text-white font-bold text-lg btn-touch"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)` }}
          >
            ✅ Done — Take Another Photo
          </motion.button>
        </motion.div>
      </div>
    </>
  );
}
