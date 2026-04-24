'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Mail, Phone, X, Send, Share2, Printer, Check, Download } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Print helper ───────────────────────────────────────────────────────────────
function printPhoto(photoUrl: string, eventName: string) {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) { toast.error('Allow popups to print'); return; }
  win.document.write(
    `<!DOCTYPE html><html><head><title>Print</title>` +
    `<style>*{margin:0;padding:0;box-sizing:border-box}` +
    `html,body{width:4in;height:6in;overflow:hidden}` +
    `@page{size:4in 6in portrait;margin:0}` +
    `.w{width:4in;height:6in;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:.15in;gap:.1in;background:#fff}` +
    `img{width:100%;height:auto;max-height:5.3in;object-fit:contain}` +
    `.n{font-size:9pt;font-weight:bold;color:#333;text-align:center}` +
    `.f{font-size:7pt;color:#888;text-align:center}` +
    `</style></head><body><div class="w">` +
    `<img src="${photoUrl}" onload="setTimeout(function(){window.print();window.close()},400)" />` +
    `<p class="n">${eventName}</p>` +
    `<p class="f">${new Date().toLocaleDateString()}</p>` +
    `</div></body></html>`
  );
  win.document.close();
}

// ── Input modal ────────────────────────────────────────────────────────────────
function InputModal({
  icon, title, placeholder, inputType, onSubmit, onClose, sending,
}: {
  icon: React.ReactNode;
  title: string;
  placeholder: string;
  inputType: string;
  onSubmit: (v: string) => Promise<void>;
  onClose: () => void;
  sending: boolean;
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
          <div className="flex items-center gap-2 text-white font-semibold">{icon}{title}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type={inputType}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && value.trim() && !sending) onSubmit(value.trim()); }}
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 mb-4"
        />
        <button
          onClick={() => { if (value.trim() && !sending) onSubmit(value.trim()); }}
          disabled={!value.trim() || sending}
          className="w-full py-3.5 rounded-xl font-bold text-white bg-purple-600 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {sending
            ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <><Send className="w-4 h-4" />Send</>
          }
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main ShareScreen ───────────────────────────────────────────────────────────
export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [modal, setModal]     = useState<'email' | 'sms' | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);

  const settings    = event?.settings as Record<string, unknown> | undefined;
  const timeoutSecs = (settings?.shareScreenTimeout as number) || 0;
  const [timeLeft, setTimeLeft] = useState(timeoutSecs);

  useEffect(() => {
    if (timeoutSecs <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); resetSession(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeoutSecs, resetSession]);

  useEffect(() => {
    if (!currentPhoto) setScreen('preview');
  }, [currentPhoto, setScreen]);

  if (!currentPhoto) return null;

  const photo        = currentPhoto;
  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';
  const eventName    = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  // shareUrl: use galleryUrl from backend (already /p/shortcode)
  // swap domain to current window origin so domain changes never break QR
  const shareUrl = (() => {
    const raw = photo.galleryUrl || '';
    if (!raw) return photo.url;
    try {
      const parsed = new URL(raw);
      return window.location.origin + parsed.pathname + parsed.search;
    } catch {
      return raw.startsWith('/') ? window.location.origin + raw : (raw || photo.url);
    }
  })();

  const allowEmail     = (settings?.allowEmailShare as boolean) !== false;
  const allowSMS       = (settings?.allowSMSShare as boolean) === true;
  const allowWhatsApp  = (settings?.allowWhatsApp as boolean) !== false;
  const allowInstagram = (settings?.allowInstagram as boolean) !== false;
  const allowAirDrop   = (settings?.allowAirDrop as boolean) !== false;
  const allowPrint     = settings?.allowPrint !== false;

  async function sendEmail(email: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, photoUrl: photo.url, galleryUrl: shareUrl, eventName }),
      });
      if (!res.ok) throw new Error('Failed');
      setDone(true); setModal(null);
      toast.success('Sent to ' + email);
      if (event) trackAction(event.id, 'photo_shared', { platform: 'email', photoId: photo.id });
    } catch { toast.error('Could not send email'); }
    finally { setSending(false); }
  }

  async function sendSMS(phone: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, photoUrl: photo.url, galleryUrl: shareUrl, eventName }),
      });
      if (!res.ok) throw new Error('Failed');
      setDone(true); setModal(null);
      toast.success('Sent via SMS');
      if (event) trackAction(event.id, 'photo_shared', { platform: 'sms', photoId: photo.id });
    } catch { toast.error('Could not send SMS'); }
    finally { setSending(false); }
  }

  function handleWhatsApp() {
    const wpCode = (settings?.whatsappCountryCode as string) || '';
    const num    = wpCode.replace(/\D/g, '');
    const text   = encodeURIComponent(`📸 ${eventName} — tap to view & save: ${shareUrl}`);
    const url    = num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    if (event) trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: photo.id });
  }

  function handleInstagram() {
    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success('Link copied — paste into Instagram Story'))
      .catch(() => toast('Open Instagram and paste your link'));
    if (event) trackAction(event.id, 'photo_shared', { platform: 'instagram', photoId: photo.id });
  }

  function handleAirDrop() {
    if (navigator.share) {
      navigator.share({ title: `${eventName} Photo`, url: shareUrl }).catch(() => {});
    } else {
      toast('AirDrop is only available on Apple devices');
    }
    if (event) trackAction(event.id, 'photo_shared', { platform: 'airdrop', photoId: photo.id });
  }

  async function handleDownload() {
    try {
      const res  = await fetch(photo.url);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `${eventName.replace(/\s+/g, '-')}-photo.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    } catch { window.open(photo.url, '_blank'); }
    if (event) trackAction(event.id, 'photo_downloaded', { photoId: photo.id });
  }

  return (
    <div className="w-full h-full flex bg-[#08080f] overflow-hidden">

      {/* LEFT — photo preview */}
      <div className="w-1/2 flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt="Your photo"
          className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          style={{ boxShadow: `0 0 60px ${primaryColor}30` }}
        />
      </div>

      {/* RIGHT — QR + share buttons */}
      <div className="w-1/2 flex flex-col justify-center px-4 py-6 gap-4 overflow-y-auto">

        {/* Event name */}
        <div className="text-center">
          <p className="text-white font-bold text-lg">{eventName}</p>
          <p className="text-white/40 text-xs mt-0.5">Scan QR to save your photo</p>
        </div>

        {/* QR code */}
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-2xl">
            <QRCodeSVG value={shareUrl} size={150} level="H" fgColor="#000" bgColor="#fff" />
          </div>
        </div>

        {/* Short URL */}
        <p className="text-white/30 text-[10px] text-center truncate px-2">{shareUrl}</p>

        {/* Timeout */}
        {timeoutSecs > 0 && (
          <p className="text-white/20 text-xs text-center">Resets in {timeLeft}s</p>
        )}

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">

          {allowEmail && (
            <button onClick={() => setModal('email')}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/10 transition-colors">
              <Mail className="w-4 h-4 text-white/70" />
              <span className="text-white/60 text-xs font-medium">Email</span>
            </button>
          )}

          {allowSMS && (
            <button onClick={() => setModal('sms')}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/10 transition-colors">
              <Phone className="w-4 h-4 text-white/70" />
              <span className="text-white/60 text-xs font-medium">SMS</span>
            </button>
          )}

          {allowWhatsApp && (
            <button onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/30 transition-colors">
              <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="text-[#25D366] text-xs font-medium">WhatsApp</span>
            </button>
          )}

          {allowInstagram && (
            <button onClick={handleInstagram}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span className="text-white text-xs font-medium">Instagram</span>
            </button>
          )}

          {allowAirDrop && (
            <button onClick={handleAirDrop}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600/20 border border-sky-500/30 hover:bg-sky-600/30 transition-colors">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span className="text-sky-400 text-xs font-medium">AirDrop</span>
            </button>
          )}

          <button onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4 text-white/70" />
            <span className="text-white/60 text-xs font-medium">Download</span>
          </button>

          {allowPrint && (
            <button onClick={() => printPhoto(photo.url, eventName)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/10 transition-colors">
              <Printer className="w-4 h-4 text-white/70" />
              <span className="text-white/60 text-xs font-medium">Print</span>
            </button>
          )}

        </div>

        {/* Done */}
        <button onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
          {done ? <><Check className="w-5 h-5" />Sent!</> : '✅ Done — New Photo'}
        </button>

      </div>

      {/* Input modals */}
      <AnimatePresence>
        {modal === 'email' && (
          <InputModal
            icon={<Mail className="w-5 h-5 text-red-400" />}
            title="Send to Email" placeholder="guest@example.com" inputType="email"
            sending={sending} onSubmit={sendEmail} onClose={() => setModal(null)}
          />
        )}
        {modal === 'sms' && (
          <InputModal
            icon={<Phone className="w-5 h-5 text-blue-400" />}
            title="Send via SMS" placeholder="+91 98765 43210" inputType="tel"
            sending={sending} onSubmit={sendSMS} onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
