'use client';

import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, MessageCircle, Share2, Mail, Check, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [copied, setCopied] = useState(false);

  if (!currentPhoto) { setScreen('preview'); return null; }

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  // ── Photo-specific URL — links ONLY to this guest's photo ──
  const photoUrl = currentPhoto.galleryUrl || currentPhoto.url;

  async function handleManualDownload() {
    const a = document.createElement('a');
    a.href = currentPhoto.downloadUrl || currentPhoto.url;
    a.download = `snapbooth_${event?.name?.replace(/\s+/g, '_') || 'photo'}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (event) await trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
    toast.success('Downloaded!');
  }

  // ── WhatsApp: native share sheet on mobile (user picks WA from their own apps)
  //              direct wa.me link on desktop as fallback ──
  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: currentPhoto.id });
    const message = `📸 Here's my photo from ${event?.name || 'the event'}!\n\nView & download: ${photoUrl}`;
    // On iOS/Android: open native share sheet pre-populated with message
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My photobooth photo', text: message, url: photoUrl });
        return;
      } catch { /* user cancelled or share failed — fall through to wa.me */ }
    }
    // Desktop fallback: open WhatsApp Web with pre-filled message
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  // ── Gmail: opens mail client with photo link in body ──
  // Browsers can't attach binary files via mailto, so we send the direct download link
  async function handleGmail() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'gmail', photoId: currentPhoto.id });
    const subject = encodeURIComponent(`Your photo from ${event?.name || 'the event'} 📸`);
    const body = encodeURIComponent(
      `Hi!\n\nHere's your photobooth moment from ${event?.name || 'the event'}.\n\n` +
      `📥 Download your photo: ${currentPhoto.downloadUrl || photoUrl}\n\n` +
      `🔗 View online: ${photoUrl}\n\n` +
      `Enjoy! 🎉`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast('Opening email — paste your address to send!', { icon: '📧', duration: 4000 });
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

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col lg:flex-row items-stretch">

          {/* ── QR Panel — encodes ONLY this guest's photo URL ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-4 p-6 sm:p-8 lg:w-80 xl:w-96 lg:border-r border-b lg:border-b-0 border-white/10 bg-[#0d0d18]/60 flex-shrink-0"
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-white font-bold text-base sm:text-lg mb-1">
                <Smartphone className="w-5 h-5" style={{ color: primaryColor }} />
                <span>Your personal QR</span>
              </div>
              <p className="text-white/40 text-xs sm:text-sm">Scan to get only your photo</p>
            </div>

            {/* QR — value is photoUrl (single photo), not event gallery */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="bg-white p-3 sm:p-4 rounded-2xl shadow-2xl"
              style={{ outline: `4px solid ${primaryColor}44` }}
            >
              <QRCodeSVG value={photoUrl} size={180} level="H" fgColor={primaryColor} bgColor="#ffffff" />
            </motion.div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: primaryColor }} />
              <p className="text-white/30 text-xs">Only your photo — private link</p>
            </div>

            {/* Copy link */}
            <button onClick={() => {
              navigator.clipboard.writeText(photoUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
              toast.success('Link copied!');
            }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white/60 hover:text-white hover:bg-white/12 transition-all text-sm font-medium w-full justify-center">
              {copied
                ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></>
                : <><Share2 className="w-4 h-4" /><span>Copy Link</span></>}
            </button>
          </motion.div>

          {/* ── Share buttons ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex flex-col justify-center gap-3 p-5 sm:p-8 max-w-lg mx-auto w-full lg:max-w-none"
          >
            <p className="text-white/40 text-xs sm:text-sm font-medium uppercase tracking-widest mb-1">Share via</p>

            {/* WhatsApp — native share sheet on mobile, WA web on desktop */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleWhatsApp}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white btn-touch text-sm sm:text-base shadow-lg"
              style={{ background: '#25D366' }}>
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="text-left">
                <p>Send via WhatsApp</p>
                <p className="text-white/70 text-xs font-normal">
                  {hasNativeShare ? 'Opens share sheet — pick WhatsApp' : 'Opens WhatsApp Web with your photo link'}
                </p>
              </div>
            </motion.button>

            {/* Gmail — mailto with download link in body */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleGmail}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white btn-touch text-sm sm:text-base shadow-lg"
              style={{ background: 'linear-gradient(135deg,#EA4335,#FF6B6B)' }}>
              <Mail className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="text-left">
                <p>Send via Email</p>
                <p className="text-white/70 text-xs font-normal">Opens mail app with your photo link</p>
              </div>
            </motion.button>

            {/* Copy link — always visible */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
              navigator.clipboard.writeText(photoUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
              toast.success('Link copied!');
            }}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white/70 btn-touch text-sm sm:text-base bg-white/8 border border-white/15 hover:bg-white/12 transition-colors">
              {copied ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Share2 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />}
              <div className="text-left">
                <p>{copied ? 'Copied!' : 'Copy photo link'}</p>
                <p className="text-white/40 text-xs font-normal">Paste anywhere to share</p>
              </div>
            </motion.button>

            {/* Download to device */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleManualDownload}
              className="flex items-center gap-4 py-4 sm:py-5 px-5 rounded-2xl font-semibold text-white/70 btn-touch text-sm sm:text-base bg-white/8 border border-white/15 hover:bg-white/12 transition-colors">
              <Download className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="text-left">
                <p>Download to Device</p>
                <p className="text-white/40 text-xs font-normal">Save photo to your camera roll</p>
              </div>
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
