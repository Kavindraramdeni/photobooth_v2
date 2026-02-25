'use client';

import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, MessageCircle, Share2, Instagram, Check } from 'lucide-react';
import { useState } from 'react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [copied, setCopied] = useState(false);

  if (!currentPhoto) {
    setScreen('preview');
    return null;
  }

  const galleryUrl = currentPhoto.galleryUrl;
  const primaryColor = event?.branding?.primaryColor || '#7c3aed';

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
    toast.success('Downloaded!');
  }

  async function handleInstagram() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'instagram', photoId: currentPhoto.id });
    toast('Download your photo first, then share to Instagram!', { icon: '📸', duration: 4000 });
    handleDownload();
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My photo from ${event?.name || 'SnapBooth'}`,
          text: 'Check out my photobooth moment! 📸',
          url: galleryUrl,
        });
        if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: currentPhoto.id });
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button
          onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-semibold">Share Your Photo</h2>
        <div className="w-16" />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center gap-6 p-6 overflow-auto">
        {/* QR Code section */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <p className="text-white/70 text-sm font-medium">📱 Scan to get your photo</p>
          
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            <QRCodeSVG
              value={galleryUrl}
              size={200}
              level="H"
              fgColor={primaryColor}
              bgColor="#ffffff"
            />
          </div>

          <p className="text-white/40 text-xs text-center max-w-48">
            Scan with your phone camera to download your photo
          </p>
        </motion.div>

        {/* Divider */}
        <div className="hidden lg:flex flex-col items-center gap-2 text-white/20">
          <div className="w-px h-20 bg-white/20" />
          <span className="text-sm">or</span>
          <div className="w-px h-20 bg-white/20" />
        </div>
        <div className="lg:hidden w-full flex items-center gap-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-sm">or share via</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Sharing buttons */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          {/* WhatsApp */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleWhatsApp}
            className="flex items-center gap-4 py-4 px-5 rounded-2xl font-semibold text-white btn-touch"
            style={{ background: '#25D366' }}
          >
            <MessageCircle className="w-6 h-6" />
            <span>Share on WhatsApp</span>
          </motion.button>

          {/* Instagram */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleInstagram}
            className="flex items-center gap-4 py-4 px-5 rounded-2xl font-semibold text-white btn-touch"
            style={{ background: 'linear-gradient(135deg, #E1306C, #F77737, #FCAF45)' }}
          >
            <Instagram className="w-6 h-6" />
            <span>Download for Instagram</span>
          </motion.button>

          {/* Native Share / Copy Link */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleNativeShare}
            className="flex items-center gap-4 py-4 px-5 rounded-2xl font-semibold text-white btn-touch bg-white/10 border border-white/20"
          >
            {copied ? <Check className="w-6 h-6 text-green-400" /> : <Share2 className="w-6 h-6" />}
            <span>{copied ? 'Link Copied!' : 'Copy Link / Share'}</span>
          </motion.button>

          {/* Download */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            className="flex items-center gap-4 py-4 px-5 rounded-2xl font-semibold text-white btn-touch bg-white/5 border border-white/10"
          >
            <Download className="w-6 h-6" />
            <span>Download Photo</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Done button */}
      <div className="px-6 pb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetSession}
          className="w-full py-5 rounded-2xl text-white font-bold text-lg btn-touch"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)` }}
        >
          ✅ Done — Take Another Photo
        </motion.button>
      </div>
    </div>
  );
}
