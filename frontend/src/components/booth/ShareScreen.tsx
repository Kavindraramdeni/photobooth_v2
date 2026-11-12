'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Mail, Phone, X, Send, Check, Share2, Printer, ArrowLeft, QrCode, CheckCircle2 } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction } from '@/lib/api';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Print fix — single page ──────────────────────────────────────────────────
function printPhotoOnly(photoUrl: string, eventName: string, scale = 98) {
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
  const safeScale = Number.isFinite(scale) ? Math.max(70, Math.min(110, scale)) : 98;
  const img = doc.createElement('img'); img.src = photoUrl; img.alt = 'photo';
  img.style.width = `${safeScale}%`;
  img.style.margin = '0 auto';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm glass-panel border border-white/15 rounded-3xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">{icon}{title}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <input type={inputType} value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder} autoFocus
          className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 mb-4 text-sm"
          onKeyDown={e => e.key === 'Enter' && value.trim() && !sending && onSubmit(value.trim())}
        />
        <button onClick={() => value.trim() && !sending && onSubmit(value.trim())}
          disabled={!value.trim() || sending}
          className="w-full py-4 rounded-2xl font-black text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all">
          {sending ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" />Send Photo</>}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function ShareScreen() {
  const { currentPhoto, event, setScreen, resetSession } = useBoothStore();
  const [modal, setModal] = useState<'email' | 'sms' | null>(null);
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentPhoto) setScreen('preview');
  }, [currentPhoto, setScreen]);

  if (!currentPhoto) return null;
  const photo = currentPhoto;

  const primaryColor = event?.branding?.primaryColor || '#7c3aed';
  const eventName = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  // Bulletproof phone-scannable QR URL resolver
  const computeQrUrl = () => {
    let raw = photo.galleryUrl || (photo as any).gallery_url || '';
    if (raw.includes('photobooth-v2-xi.vercel.app')) {
      raw = raw.replace('photobooth-v2-xi.vercel.app', 'photobooth-v2-ten.vercel.app');
    }
    if (!raw || raw.startsWith('blob:')) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://photobooth-v2-ten.vercel.app';
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const baseHost = isLocalhost ? 'https://photobooth-v2-ten.vercel.app' : origin;
      if ((photo as any).short_code) {
        raw = `${baseHost}/p/${(photo as any).short_code}`;
      } else if (event?.slug) {
        raw = `${baseHost}/gallery/${event.slug}`;
      } else {
        raw = `${baseHost}/gallery/snapbooth-demo`;
      }
    }
    return raw;
  };
  const photoUrl = computeQrUrl();
  const settings = event?.settings as Record<string, unknown> | undefined;
  const allowEmail = (settings?.allowEmailShare as boolean) !== false;
  const allowInstagram = (settings?.allowInstagram as boolean) !== false;
  const allowAirDrop = (settings?.allowAirDrop as boolean) !== false;
  const allowWhatsApp = (settings?.allowWhatsApp as boolean) !== false;
  const allowSMS = (settings?.allowSMSShare as boolean) === true;
  const allowPrint = (settings?.allowPrint as boolean) !== false;
  const printScale = (settings?.printScale as number) || 98;
  
  // Share auto-timeout
  const timeoutSecs = (settings?.shareScreenTimeout as number) || 0;
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

  const whatsappCountryCode = (settings?.whatsappCountryCode as string) || '';

  function handleInstagram() {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      navigator.share({ title: eventName, url: photoUrl });
    } else {
      navigator.clipboard.writeText(photoUrl).then(() => {
        toast.success('Link copied! Open Instagram and paste into Story.');
      }).catch(() => window.open(photoUrl, '_blank'));
    }
    if (event) trackAction(event.id, 'photo_shared', { platform: 'instagram', photoId: photo.id });
  }

  function handleAirDrop() {
    if (navigator.share) {
      navigator.share({ title: eventName, text: '📸 Your photobooth photo', url: photoUrl })
        .catch(() => {});
      if (event) trackAction(event.id, 'photo_shared', { platform: 'airdrop', photoId: photo.id });
    } else {
      toast('AirDrop requires Safari on iOS or macOS');
    }
  }

  async function handleWhatsApp() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'whatsapp', photoId: photo.id });
    setShowWhatsAppQR(true);
  }

  async function handleNativeShare() {
    if (event) await trackAction(event.id, 'photo_shared', { platform: 'native', photoId: photo.id });
    if (navigator.share) {
      try { await navigator.share({ title: eventName, text: '📸 Your photobooth photo', url: photoUrl }); return; }
      catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(photoUrl); toast.success('Link copied to clipboard!'); }
    catch { toast('Could not copy link'); }
  }

  async function handlePrint() {
    if (!event) return;
    try {
      printPhotoOnly(photo.url, eventName, printScale);
      await trackAction(event.id, 'photo_printed', { photoId: photo.id });
      toast.success('Sent to printer! 🖨️');
    } catch { toast.error('Print failed'); }
  }

  async function sendEmail(email: string) {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, toEmail: email }),
      });
      const raw = await res.text();
      let data: { error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || 'Email failed' }; }
      if (!res.ok) throw new Error(data.error || 'Email failed');
      setSent(prev => new Set(prev).add('email'));
      setModal(null);
      toast.success(`Photo dispatched to ${email}! 📧`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      if (msg.includes('not configured')) {
        setModal(null);
        const subject = encodeURIComponent(`${eventName} — your photo 📸`);
        const body = encodeURIComponent(`Here's your photo: ${photoUrl}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        toast('Opening email client...', { duration: 2000 });
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
      const raw = await res.text();
      let data: { error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || 'SMS failed' }; }
      if (!res.ok) throw new Error(data.error || 'SMS failed');
      setSent(prev => new Set(prev).add('sms'));
      setModal(null);
      toast.success(`Photo sent via SMS to ${phone}! 📱`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      toast.error(msg.includes('not configured') ? 'SMS not configured for this booth' : msg);
    } finally { setSending(false); }
  }

  return (
    <div className="w-full h-full flex flex-col bg-transparent select-none overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/10 glass-crystal z-20" onClick={resetTimer}>
        <button
          onClick={() => setScreen('preview')}
          className="text-slate-600 dark:text-white/60 hover:text-purple-600 dark:hover:text-white transition-colors text-xs font-bold px-3 py-1.5 rounded-xl glass-crystal-pill flex items-center gap-1.5 active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Preview
        </button>
        <div className="text-center">
          <h2 className="text-slate-900 dark:text-white font-black text-sm tracking-wide uppercase">Download &amp; Share</h2>
          {timeoutSecs > 0 && (
            <p className="text-slate-400 dark:text-white/30 text-[10px] mt-0.5 font-bold">
              Auto-closes in {timeLeft}s
            </p>
          )}
        </div>
        <div className="w-20" />
      </div>

      {/* Timeout Progress Line */}
      {timeoutSecs > 0 && (
        <div className="h-1 bg-black/5 dark:bg-white/5 flex-shrink-0">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / timeoutSecs) * 100}%`, background: primaryColor }}
          />
        </div>
      )}

      {/* Body Stage */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full z-10 p-4 sm:p-8 flex items-center justify-center">
        <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto w-full items-center justify-center">
          {/* Photo Display Card */}
          <div className="w-full lg:flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="relative rounded-3xl overflow-hidden shadow-2xl border border-black/5 dark:border-white/15 max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] bg-white/20 dark:bg-black/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Your photo"
                className="w-full h-auto max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-3xl"
                draggable={false}
              />
            </motion.div>
          </div>

          {/* QR Code & Share Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-5 glass-crystal rounded-3xl p-6 shadow-2xl border border-black/5 dark:border-white/15"
          >
            {/* High-Contrast QR Code Card */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-3xl shadow-xl flex items-center justify-center ring-4 ring-purple-500/20">
                <QRCodeSVG
                  value={photoUrl}
                  size={190}
                  level="H"
                  fgColor="#07070d"
                  bgColor="#ffffff"
                  className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]"
                />
              </div>
              <div className="text-center">
                <p className="text-slate-900 dark:text-white font-black text-sm">Scan with Phone Camera</p>
                <p className="text-slate-500 dark:text-white/40 text-xs mt-0.5 font-medium">Instant full-resolution download</p>
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* WhatsApp */}
              {allowWhatsApp && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleWhatsApp}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs bg-[#25D366] hover:bg-[#20ba5a] shadow-lg shadow-[#25D366]/20 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>WhatsApp</span>
                </motion.button>
              )}

              {/* Instagram */}
              {allowInstagram && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleInstagram}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs shadow-lg transition-all cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>Instagram</span>
                </motion.button>
              )}

              {/* Email */}
              {allowEmail && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setModal('email')}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs bg-red-600/90 hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email</span>
                </motion.button>
              )}

              {/* AirDrop */}
              {allowAirDrop && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleAirDrop}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs bg-sky-600/90 hover:bg-sky-500 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>AirDrop</span>
                </motion.button>
              )}

              {/* SMS */}
              {allowSMS && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setModal('sms')}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>SMS</span>
                </motion.button>
              )}

              {/* Print */}
              {allowPrint && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-white text-xs glass-pill hover:bg-white/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Bar: Done */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 glass-panel z-20">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetSession}
          className="w-full py-4 rounded-2xl font-black text-white text-base tracking-wide flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)` }}
        >
          <CheckCircle2 className="w-5 h-5" /> Done — Next Guest
        </motion.button>
      </div>

      {/* WhatsApp QR Modal */}
      <AnimatePresence>
        {showWhatsAppQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
            onClick={() => setShowWhatsAppQR(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-sm glass-panel border border-white/15 rounded-3xl p-6 text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center text-white">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-bold text-base">Send via WhatsApp</h3>
                </div>
                <button
                  onClick={() => setShowWhatsAppQR(false)}
                  className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const phone = whatsappCountryCode.replace(/\D/g, '');
                const text = encodeURIComponent(`📸 ${eventName} — here is your photo: ${photoUrl}`);
                const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
                return (
                  <>
                    <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-xl">
                      <QRCodeSVG value={waUrl} size={180} level="H" fgColor="#07070d" bgColor="#ffffff" />
                    </div>
                    <p className="text-white/60 text-xs mt-3">
                      Scan this QR code from your mobile device to open WhatsApp directly.
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(waUrl).then(
                          () => toast.success('WhatsApp link copied!'),
                          () => toast.error('Could not copy link')
                        );
                      }}
                      className="mt-4 w-full py-3.5 rounded-2xl font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] shadow-lg shadow-[#25D366]/20 transition-all text-xs"
                    >
                      Copy WhatsApp Link
                    </button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}

        {modal === 'email' && (
          <InputModal
            icon={<Mail className="w-5 h-5 text-red-400" />}
            title="Send Photo to Email"
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
            title="Send Photo via SMS"
            placeholder="+1 555 123 4567"
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
