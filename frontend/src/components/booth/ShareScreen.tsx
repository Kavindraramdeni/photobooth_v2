'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Mail, Phone, X, Send, Check, Share2, Printer } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function openWhatsApp(photoUrl: string, eventName: string) {
  const text = encodeURIComponent('📸 ' + eventName + ' — tap to view & save your photo: ' + photoUrl);
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ── Print fix — single page, no blank pages ───────────────────────────────────
function printPhotoOnly(photoUrl: string, eventName: string) {
  const existing = document.getElementById('__snapbooth_print_frame');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__snapbooth_print_frame';
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) { window.open(photoUrl, '_blank'); return; }
  doc.open(); doc.close();
  const style = doc.createElement('style');
  style.textContent = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'html, body { width:100%; height:100%; overflow:hidden; background:#fff; }',
    '@page { margin:0; size:4in 6in portrait; }',
    '@media print { html, body { height:auto; overflow:hidden; }',
    '  * { page-break-after:avoid !important; page-break-before:avoid !important; page-break-inside:avoid !important; }',
    '  img { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }',
    '.wrap { display:flex; flex-direction:column; align-items:center; justify-content:flex-start;',
    '        width:4in; height:6in; overflow:hidden; padding:0.15in; gap:0.08in; }',
    'img { width:100%; height:auto; max-height:5.4in; object-fit:contain; display:block; }',
    '.footer { font-size:8pt; color:#555; text-align:center; }',
    '.event-name { font-size:9pt; font-weight:bold; color:#333; }',
  ].join(' ');
  doc.head.appendChild(style);
  const wrap = doc.createElement('div'); wrap.className = 'wrap';
  const img = doc.createElement('img'); img.src = photoUrl; img.alt = 'photo';
  wrap.appendChild(img);
  const nameEl = doc.createElement('p'); nameEl.className = 'event-name'; nameEl.textContent = eventName;
  wrap.appendChild(nameEl);
  const footer = doc.createElement('p'); footer.className = 'footer';
  footer.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  wrap.appendChild(footer);
  doc.body.appendChild(wrap);
  function doPrint() { win!.focus(); win!.print(); }
  if (img.complete) { setTimeout(doPrint, 400); } else { img.onload = () => setTimeout(doPrint, 400); }
  setTimeout(() => { document.getElementById('__snapbooth_print_frame')?.remove(); }, 30000);
}

// ── Input modal ───────────────────────────────────────────────────────────────
function InputModal({ icon, title, placeholder, inputType, onSubmit, onClose, sending }: {
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
          <div className="flex items-center gap-2 text-white font-semibold">{icon}{title}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>
        <input type={inputType} value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder} autoFocus
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 mb-4"
          onKeyDown={e => e.key === 'Enter' && value.trim() && !sending && onSubmit(value.trim())}
        />
        <button onClick={() => value.trim() && !sending && onSubmit(value.trim())}
          disabled={!value.trim() || sending}
          className="w-full py-3.5 rounded-xl font-bold text-white bg-purple-600 disabled:opacity-40 flex items-center justify-center gap-2">
          {sending ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" />Send</>}
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
  const photo = currentPhoto;

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';
  const photoUrl = photo.galleryUrl || photo.url;
  const allowEmail = (event?.settings?.allowEmailShare as boolean) !== false;
  const allowSMS = (event?.settings?.allowSMSShare as boolean) === true;
  const allowPrint = event?.settings?.allowPrint !== false;

  // ── Share screen auto-timeout ───────────────────────────────────────────────
  const timeoutSecs = (event?.settings?.shareScreenTimeout as number) || 0; // 0 = disabled
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeoutSecs);

  const resetTimer = useCallback(() => {
    if (!timeoutSecs) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(timeoutSecs);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); resetSession(); return 0; }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = interval;
  }, [timeoutSecs, resetSession]);

  useEffect(() => {
    if (!timeoutSecs) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeoutSecs, resetTimer]);

  // ── WhatsApp with country code pre-fill ────────────────────────────────────
  const whatsappCountryCode = (event?.settings?.whatsappCountryCode as string) || '';

  // ── Instagram share ────────────────────────────────────────────────────────
  function handleInstagram() {
    // Instagram doesn't support direct URL sharing — open story intent on mobile,
    // fallback to copying the photo URL on desktop
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      navigator.share({ title: eventName, url: photoUrl });
    } else {
      navigator.clipboard.writeText(photoUrl).then(() => {
        toast.success('Link copied! Paste into Instagram Story');
      }).catch(() => window.open(photoUrl, '_blank'));
    }
    if (event) trackAction(event.id, 'photo_shared', { platform: 'instagram', photoId: photo.id });
  }

  // ── AirDrop ────────────────────────────────────────────────────────────────
  function handleAirDrop() {
    // AirDrop is triggered via native share sheet on iOS/macOS
    if (navigator.share) {
      navigator.share({ title: eventName, text: '📸 Your photo', url: photoUrl })
        .catch(() => {});
      if (event) trackAction(event.id, 'photo_shared', { platform: 'airdrop', photoId: photo.id });
    } else {
      toast('AirDrop is only available on Apple devices');
    }
  }

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: photo.id });
    if (whatsappCountryCode) {
      // Pre-fill phone number with country code
      const phone = whatsappCountryCode.replace(/\D/g, '');
      const text = encodeURIComponent('📸 ' + eventName + ' — tap to view & save your photo: ' + photoUrl);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      openWhatsApp(photoUrl, eventName);
    }
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

  async function handlePrint() {
    if (!event) return;
    try {
      printPhotoOnly(photo.url, eventName);
      await trackAction(event.id, 'photo_printed', { photoId: photo.id });
      toast.success('Sent to printer!');
    } catch { toast.error('Print failed'); }
  }

  async function sendEmail(email: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        setModal(null);
        const subject = encodeURIComponent(`${eventName} — your photo 📸`);
        const body = encodeURIComponent(`Here's your photo: ${photoUrl}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        toast('📧 Opening email app...', { duration: 2000 });
      } else { toast.error(msg); }
    } finally { setSending(false); }
  }

  async function sendSMS(phone: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } finally { setSending(false); }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] select-none overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18]" onClick={resetTimer}>
        <button onClick={() => setScreen('preview')}
          className="text-white/50 hover:text-white transition-colors text-sm px-2 py-1">
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-base">Share Your Photo</h2>
          {timeoutSecs > 0 && (
            <p className="text-white/30 text-[10px] mt-0.5">
              Auto-close in {timeLeft}s
            </p>
          )}
        </div>
        <div className="w-16" />
      </div>
      {/* Timeout progress bar */}
      {timeoutSecs > 0 && (
        <div className="h-0.5 bg-white/5 flex-shrink-0">
          <div className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / timeoutSecs) * 100}%`, background: primaryColor }} />
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT — Full photo */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="w-full h-full flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Your photo"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{ maxHeight: 'calc(100dvh - 160px)' }}
              draggable={false}
            />
          </motion.div>
        </div>

        {/* RIGHT — QR + actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-48 sm:w-56 flex-shrink-0 flex flex-col gap-3 py-4 px-3 border-l border-white/8 bg-[#0d0d18]/60 overflow-y-auto"
        >
          {/* QR Code */}
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white p-2.5 rounded-xl shadow-lg">
              <QRCodeSVG value={photoUrl} size={130} level="H" fgColor="#000000" bgColor="#ffffff" />
            </div>
            <p className="text-white/40 text-[10px] text-center leading-tight">
              📱 Scan to get your photo
            </p>
          </div>

          <div className="h-px bg-white/8" />

          {/* WhatsApp */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleWhatsApp}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch"
            style={{ background: '#25D366' }}>
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </motion.button>

          {/* Email */}
          {allowEmail && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setModal('email')}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch relative"
              style={{ background: 'linear-gradient(135deg,#EA4335,#c5221f)' }}>
              {sent.has('email') && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-green-600" /></span>}
              <Mail className="w-5 h-5 flex-shrink-0" />
              Send Email
            </motion.button>
          )}

          {/* SMS */}
          {allowSMS && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setModal('sms')}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch bg-blue-600 relative">
              {sent.has('sms') && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-green-600" /></span>}
              <Phone className="w-5 h-5 flex-shrink-0" />
              Send SMS
            </motion.button>
          )}

          {/* Native Share */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleNativeShare}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch bg-white/8 border border-white/15 hover:bg-white/12 transition-colors">
            <Share2 className="w-5 h-5 flex-shrink-0" />
            Share
          </motion.button>

          {/* Instagram */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleInstagram}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch"
            style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}>
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Instagram
          </motion.button>

          {/* AirDrop — Apple devices only */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleAirDrop}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch bg-sky-600/80 border border-sky-500/30">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v8M8 6l4-4 4 4M4 14a8 8 0 0016 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            AirDrop
          </motion.button>

          {/* Print */}
          {allowPrint && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={handlePrint}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-white text-xs btn-touch bg-white/8 border border-white/15 hover:bg-white/12 transition-colors">
              <Printer className="w-5 h-5 flex-shrink-0" />
              Print
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* ── Bottom — Done centred ── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t border-white/8 bg-[#0d0d18]/40">
        <motion.button whileTap={{ scale: 0.98 }} onClick={resetSession}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm btn-touch"
          style={{ background: `linear-gradient(135deg,${primaryColor},${primaryColor}aa)` }}>
          ✅ Done — Take Another
        </motion.button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'email' && (
          <InputModal icon={<Mail className="w-5 h-5 text-red-400" />} title="Send to Email"
            placeholder="guest@example.com" inputType="email" sending={sending}
            onSubmit={sendEmail} onClose={() => setModal(null)} />
        )}
        {modal === 'sms' && (
          <InputModal icon={<Phone className="w-5 h-5 text-blue-400" />} title="Send via SMS"
            placeholder="+91 98765 43210" inputType="tel" sending={sending}
            onSubmit={sendSMS} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
