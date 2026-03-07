'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Share2, Mail, Eye, Phone, X, Send, Check } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function openWhatsApp(photoUrl: string, eventName: string) {
  const text = encodeURIComponent('📸 ' + eventName + ' — tap to view & save your photo: ' + photoUrl);
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ── Slide-up input modal ──────────────────────────────────────────────────────
function InputModal({
  icon, title, placeholder, inputType, onSubmit, onClose, sending,
}: {
  icon: React.ReactNode; title: string; placeholder: string; inputType: string;
  onSubmit: (value: string) => Promise<void>; onClose: () => void; sending: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-[#12121a] border border-white/10 rounded-t-3xl p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            {icon}
            {title}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type={inputType}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 mb-4 text-base"
          onKeyDown={e => e.key === 'Enter' && value.trim() && !sending && onSubmit(value.trim())}
        />
        <button
          onClick={() => value.trim() && !sending && onSubmit(value.trim())}
          disabled={!value.trim() || sending}
          className="w-full py-3.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-base"
        >
          {sending
            ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <><Send className="w-4 h-4" /> Send</>
          }
        </button>
      </motion.div>
    </motion.div>
  );
}

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [modal, setModal] = useState<'email' | 'sms' | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  if (!currentPhoto) { setScreen('preview'); return null; }
  const photo = currentPhoto; // captured for use inside async functions

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';
  const photoUrl = photo.galleryUrl || photo.url;

  // Read operator toggles from event settings
  const allowEmail = (event?.settings?.allowEmailShare as boolean) !== false; // on by default
  const allowSMS   = (event?.settings?.allowSMSShare as boolean) === true;    // off by default

  // Number of columns in the share grid
  const colCount = 2 + (allowEmail ? 1 : 0) + (allowSMS ? 1 : 0);

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: photo.id });
    openWhatsApp(photoUrl, eventName);
  }

  async function handleNativeShare() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: photo.id });
    if (navigator.share) {
      try { await navigator.share({ title: eventName, text: '📸 Your photobooth photo', url: photoUrl }); return; }
      catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(photoUrl); toast.success('Link copied!'); }
    catch { toast('Could not copy link'); }
  }

  async function sendEmail(email: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, toEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email failed');
      setSent(prev => new Set(prev).add('email'));
      setModal(null);
      toast.success(`📧 Photo sent to ${email}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      if (msg.includes('not configured')) {
        // Graceful fallback to mailto when Resend not set up
        setModal(null);
        const subject = encodeURIComponent(`${eventName} — your photo 📸`);
        const body    = encodeURIComponent(`Here's your photo: ${photoUrl}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        toast('📧 Opening email app...', { duration: 2000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  }

  async function sendSMS(phone: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, toPhone: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SMS failed');
      setSent(prev => new Set(prev).add('sms'));
      setModal(null);
      toast.success(`📱 Photo sent to ${phone}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      toast.error(msg.includes('not configured') ? 'SMS not enabled for this event' : msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]">
        <button onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors btn-touch p-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-bold text-base">Share Your Photo</h2>
        <div className="w-14" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-6 overflow-y-auto">

        {/* QR Code */}
        <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            <QRCodeSVG value={photoUrl} size={200} level="H" fgColor="#000000" bgColor="#ffffff" />
          </div>
          <p className="text-white/50 text-sm text-center">
            📱 Scan with your phone camera to get your photo
          </p>
        </motion.div>

        {/* Share buttons — dynamic grid based on enabled channels */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="w-full max-w-sm grid gap-3"
          style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
        >
          {/* WhatsApp — always shown */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs"
            style={{ background: '#25D366' }}>
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </motion.button>

          {/* Email — operator toggle */}
          {allowEmail && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => setModal('email')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs relative"
              style={{ background: 'linear-gradient(135deg,#EA4335,#c5221f)' }}>
              {sent.has('email') && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </span>
              )}
              <Mail className="w-7 h-7" />
              Email
            </motion.button>
          )}

          {/* SMS — operator toggle */}
          {allowSMS && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => setModal('sms')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs bg-blue-600 hover:bg-blue-500 relative">
              {sent.has('sms') && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </span>
              )}
              <Phone className="w-7 h-7" />
              SMS
            </motion.button>
          )}

          {/* Native share — always shown */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl font-semibold text-white btn-touch text-xs bg-white/10 border border-white/20">
            <Share2 className="w-7 h-7" />
            Share
          </motion.button>
        </motion.div>

        {/* Preview link */}
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setScreen('preview')}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm btn-touch">
          <Eye className="w-4 h-4" />
          Preview photo
        </motion.button>
      </div>

      {/* Done */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-white/10 bg-[#0d0d18]/40">
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-base btn-touch"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}aa)` }}>
          ✅ Done — Take Another Photo
        </motion.button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'email' && (
          <InputModal
            icon={<Mail className="w-5 h-5 text-red-400" />}
            title="Send to Email"
            placeholder="guest@example.com"
            inputType="email"
            sending={sending}
            onSubmit={sendEmail}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'sms' && (
          <InputModal
            icon={<Phone className="w-5 h-5 text-blue-400" />}
            title="Send via SMS"
            placeholder="+44 7911 123456"
            inputType="tel"
            sending={sending}
            onSubmit={sendSMS}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
