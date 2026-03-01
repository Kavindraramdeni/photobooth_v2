'use client';

import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, MessageCircle, Share2, Instagram, Check, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  if (!currentPhoto) { setScreen('preview'); return null; }

  const galleryUrl = currentPhoto.galleryUrl;
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function handleCopyLink() {
    await navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Link copied!');
  }

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: currentPhoto.id });
    window.open(currentPhoto.whatsappUrl, '_blank');
  }

  async function handleDownload() {
    const a = document.createElement('a');
    a.href = currentPhoto.downloadUrl;
    a.download = `snapbooth_photo_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
    toast.success('Saved to device!');
  }

  async function handleInstagram() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'instagram', photoId: currentPhoto.id });
    toast('Save your photo, then share to Instagram!', { icon: '📸', duration: 4000 });
    handleDownload();
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `My photo from ${event?.name || 'SnapBooth'}`, text: 'Check out my photobooth moment! 📸', url: galleryUrl });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: currentPhoto.id });
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink();
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base sm:text-lg">Share Your Photo</h2>
          {event?.name && <p className="text-white/30 text-xs mt-0.5 hidden sm:block">{event.name}</p>}
        </div>
        <div className="w-10 sm:w-20" />
      </div>

      {/* ── Body: landscape = side-by-side, portrait = stacked ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col lg:flex-row items-stretch">

          {/* ── Left / Top: QR panel ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-4 sm:gap-5 p-6 sm:p-8 lg:w-80 xl:w-96 lg:border-r border-b lg:border-b-0 border-white/10 bg-[#0d0d18]/60 flex-shrink-0"
          >
            {/* QR heading */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-white font-bold text-base sm:text-lg mb-1">
                <Smartphone className="w-5 h-5" style={{ color: primaryColor }} />
                <span>Scan with phone</span>
              </div>
              <p className="text-white/40 text-xs sm:text-sm">Point your camera at the QR code</p>
            </div>

            {/* QR code */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="bg-white p-3 sm:p-4 rounded-2xl shadow-2xl ring-4"
              style={{ ringColor: `${primaryColor}44` }}
            >
              <QRCodeSVG value={galleryUrl} size={180} level="H" fgColor={primaryColor} bgColor="#ffffff" />
            </motion.div>

            {/* Pulse hint */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: primaryColor }} />
              <p className="text-white/30 text-xs">Ready to scan</p>
            </div>

            {/* Copy link */}
            <button onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white/60 hover:text-white hover:bg-white/12 transition-all text-sm font-medium w-full justify-center">
              {copied ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Share2 className="w-4 h-4" /><span>Copy Link</span></>}
            </button>
          </motion.div>

          {/* ── Right / Bottom: Share buttons ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex flex-col justify-center gap-3 p-5 sm:p-8 max-w-lg mx-auto w-full lg:max-w-none"
          >
            <p className="text-white/40 text-xs sm:text-sm font-medium uppercase tracking-widest mb-1">Share via</p>

            {/* WhatsApp */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleWhatsApp}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white btn-touch text-sm sm:text-base shadow-lg"
              style={{ background: '#25D366' }}>
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span>Send via WhatsApp</span>
            </motion.button>

            {/* Native share (iOS/Android) */}
            {hasNativeShare && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleNativeShare}
                className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white btn-touch text-sm sm:text-base border border-white/20"
                style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}bb)` }}>
                {shared ? <Check className="w-5 h-5 text-green-300 flex-shrink-0" /> : <Share2 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />}
                <span>{shared ? 'Shared!' : 'Share via…'}</span>
              </motion.button>
            )}

            {/* Instagram */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleInstagram}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white btn-touch text-sm sm:text-base shadow-lg"
              style={{ background: 'linear-gradient(135deg,#E1306C,#F77737,#FCAF45)' }}>
              <Instagram className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span>Save for Instagram</span>
            </motion.button>

            {/* Download */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleDownload}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white/80 btn-touch text-sm sm:text-base bg-white/8 border border-white/15 hover:bg-white/12 transition-colors">
              <Download className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span>Download to Device</span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ── Done ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-5 sm:pb-8 pt-3 border-t border-white/10 bg-[#0d0d18]/40">
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 sm:py-5 rounded-2xl font-bold text-white text-sm sm:text-base btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}aa)` }}>
          ✅ Done — Take Another Photo
        </motion.button>
      </div>
    </div>
  );
}
