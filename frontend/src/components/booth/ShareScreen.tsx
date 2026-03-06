'use client';

import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Share2, Mail, Eye, Instagram } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Native share with actual image file ──────────────────────────────────────
// On iOS 15+ / Android: navigator.canShare({ files }) lets us share the real
// image binary — guests can AirDrop, WhatsApp, Instagram Stories directly.
// Falls back to URL share, then wa.me.
async function nativeSharePhoto(
  photoUrl: string,
  filename: string,
  pageUrl: string,
  title: string,
) {
  try {
    const res = await fetch(photoUrl, { mode: 'cors' });
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, url: pageUrl });
      return 'file';
    }
  } catch { /* file share not supported or cancelled */ }

  // Fallback: share URL
  if (navigator.share) {
    try {
      await navigator.share({ title, url: pageUrl });
      return 'url';
    } catch { /* cancelled */ }
  }
  return 'none';
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
function openWhatsApp(photoUrl: string, eventName: string) {
  const text = encodeURIComponent('📸 ' + eventName + ' — tap to view & save your photo: ' + photoUrl);
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ── Email ─────────────────────────────────────────────────────────────────────
function openEmail(photoUrl: string, eventName: string) {
  const subject = encodeURIComponent(eventName + ' — your photo 📸');
  const body = encodeURIComponent(photoUrl);
  window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
}

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();

  if (!currentPhoto) { setScreen('preview'); return null; }

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  // Use short URL if available, otherwise gallery URL
  const photoUrl = currentPhoto.galleryUrl || currentPhoto.url;

  // Meaningful filename: EventName-YYYY-MM-DD.jpg
  const date = new Date().toISOString().split('T')[0];
  const filename = `${eventName.replace(/\s+/g, '-')}-${date}.jpg`;

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: currentPhoto.id });
    openWhatsApp(photoUrl, eventName);
  }

  async function handleEmail() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'email', photoId: currentPhoto.id });
    openEmail(photoUrl, eventName);
    toast('📧 Opening email — enter your address and send!', { duration: 3000 });
  }

  async function handleNativeShare() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: currentPhoto.id });
    const result = await nativeSharePhoto(
      currentPhoto.downloadUrl || currentPhoto.url,
      filename,
      photoUrl,
      `My photo from ${eventName}`,
    );
    if (result === 'none') {
      // Copy link as last resort
      await navigator.clipboard.writeText(photoUrl);
      toast.success('Link copied!');
    }
  }

  // Instagram Stories: download the 9:16 server-generated version
  async function handleInstagramStories() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'instagram_stories', photoId: currentPhoto.id });
    try {
      toast('Preparing Stories image…', { duration: 2000 });
      const res = await fetch(`${API_BASE}/api/photos/${currentPhoto.id}/stories`);
      if (!res.ok) throw new Error('Stories generation failed');
      const blob = await res.blob();
      const storiesFilename = `${eventName.replace(/\s+/g, '-')}-Stories-${date}.jpg`;
      const file = new File([blob], storiesFilename, { type: 'image/jpeg' });

      // Try file share first (lets user go directly to Instagram Stories)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${eventName} — Instagram Stories` });
        return;
      }
      // Fallback: download the Stories image so they can post manually
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = storiesFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast('Stories image saved! Open Instagram → + → Story to post it.', { duration: 5000 });
    } catch {
      toast.error('Could not prepare Stories image');
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-bold text-base">Share Your Photo</h2>
        <div className="w-14" />
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-5 overflow-y-auto">

        {/* QR Code — always B&W, short URL = smaller/faster QR */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            <QRCodeSVG
              value={photoUrl}
              size={180}
              level="H"
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-white/40 text-xs text-center">
            📱 Scan with phone camera to get your photo
          </p>
        </motion.div>

        {/* 4 share buttons: WhatsApp · Email · Share · Instagram */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm grid grid-cols-4 gap-2"
        >
          {/* WhatsApp */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleWhatsApp}
            className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-white btn-touch text-[11px]"
            style={{ background: '#25D366' }}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </motion.button>

          {/* Email */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleEmail}
            className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-white btn-touch text-[11px]"
            style={{ background: 'linear-gradient(135deg,#EA4335,#c5221f)' }}>
            <Mail className="w-6 h-6" />
            Email
          </motion.button>

          {/* Share (native sheet — shares actual image file on iOS 15+/Android) */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleNativeShare}
            className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-white btn-touch text-[11px] bg-white/10 border border-white/20">
            <Share2 className="w-6 h-6" />
            Share
          </motion.button>

          {/* Instagram Stories */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleInstagramStories}
            className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-white btn-touch text-[11px]"
            style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}>
            <Instagram className="w-6 h-6" />
            Stories
          </motion.button>
        </motion.div>

        {/* Preview link */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 transition-colors text-sm btn-touch">
          <Eye className="w-4 h-4" />
          Preview photo
        </motion.button>
      </div>

      {/* Done */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-white/10 bg-[#0d0d18]/40">
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-base btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}aa)` }}>
          ✅ Done — Take Another Photo
        </motion.button>
      </div>
    </div>
  );
}

// ── WhatsApp: open wa.me with number picker so guest types their own number ──
// wa.me without a number = opens WhatsApp with "New chat" so guest picks contact.
// This sends the photo download link — browsers cannot attach binary files via WA API.
// The link opens the gallery page where guest can save the photo.
function openWhatsApp(photoUrl: string, eventName: string) {
  // Direct link — opens WhatsApp, guest picks contact, message is pre-filled
  const text = encodeURIComponent('📸 ' + eventName + ' — tap to view & save your photo: ' + photoUrl);
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ── Email: clean subject only, guest types their own address ──
// Body contains only the photo link — no wall of text
function openEmail(photoUrl: string, eventName: string) {
  const subject = encodeURIComponent(eventName + ' — your photo 📸');
  const body = encodeURIComponent(photoUrl);
  window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
}

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();

  if (!currentPhoto) { setScreen('preview'); return null; }

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  // Per-photo URL — links only to this guest's photo
  const photoUrl = currentPhoto.galleryUrl || currentPhoto.url;

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: currentPhoto.id });
    openWhatsApp(photoUrl, eventName);
  }

  async function handleEmail() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'email', photoId: currentPhoto.id });
    openEmail(photoUrl, eventName);
    toast('📧 Opening email — enter your address and send!', { duration: 3000 });
  }

  async function handleNativeShare() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: currentPhoto.id });
    if (navigator.share) {
      try {
        await navigator.share({ title: eventName, text: '📸 Your photobooth photo', url: photoUrl });
        return;
      } catch { /* cancelled */ }
    }
    // Fallback: copy link
    await navigator.clipboard.writeText(photoUrl);
    toast.success('Link copied!');
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-bold text-base">Share Your Photo</h2>
        <div className="w-14" />
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-6 overflow-y-auto">

        {/* ── QR Code — always black & white, easy to scan ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            {/* fgColor always #000000 — brand colour makes QR hard to scan */}
            <QRCodeSVG
              value={photoUrl}
              size={200}
              level="H"
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-white/50 text-sm text-center">
            📱 Scan with your phone camera to get your photo
          </p>
        </motion.div>

        {/* ── 3 action buttons: WhatsApp · Email · Share ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="w-full max-w-sm grid grid-cols-3 gap-3"
        >
          {/* WhatsApp */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs"
            style={{ background: '#25D366' }}
          >
            {/* WhatsApp SVG icon */}
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </motion.button>

          {/* Email */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleEmail}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs"
            style={{ background: 'linear-gradient(135deg,#EA4335,#c5221f)' }}
          >
            <Mail className="w-7 h-7" />
            Email
          </motion.button>

          {/* Share (native sheet / copy link) */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs bg-white/10 border border-white/20"
          >
            <Share2 className="w-7 h-7" />
            Share
          </motion.button>
        </motion.div>

        {/* ── Preview button — see photo again ── */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm btn-touch"
        >
          <Eye className="w-4 h-4" />
          Preview photo
        </motion.button>
      </div>

      {/* ── Done ── */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-white/10 bg-[#0d0d18]/40">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-base btn-touch transition-all"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}aa)` }}
        >
          ✅ Done — Take Another Photo
        </motion.button>
      </div>
    </div>
  );
}
