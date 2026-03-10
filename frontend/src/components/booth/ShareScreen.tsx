'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Mail, MessageSquare, Check, Printer, RefreshCw } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { trackAction, sharePhotoByEmail, sharePhotoBySMS } from '@/lib/api';
import toast from 'react-hot-toast';

export function ShareScreen() {
  const { currentPhoto, event, resetSession } = useBoothStore();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showSMSInput, setShowSMSInput] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSMSSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);

  const branding = event?.branding;
  const settings = event?.settings;
  const primaryColor = branding?.primaryColor || '#7c3aed';
  const photoUrl  = currentPhoto?.url || '';
  const galleryUrl = currentPhoto?.galleryUrl || currentPhoto?.url || '';
  const qrCode    = currentPhoto?.qrCode || '';
  const eventName = branding?.eventName || event?.name || 'SnapBooth';

  const allowEmail = settings?.allowEmailShare !== false;
  const allowSMS   = settings?.allowSMSShare === true;
  const allowPrint = settings?.allowPrint !== false;

  async function handleDownload() {
    if (!photoUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventName.replace(/\s+/g, '_')}_photo.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (event?.id && currentPhoto?.id) {
        trackAction(event.id, 'photo_downloaded', { photoId: currentPhoto.id });
      }
    } catch {
      window.open(photoUrl, '_blank');
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  async function handleShare() {
    const url = galleryUrl || photoUrl;
    if (navigator.share) {
      try {
        await navigator.share({ title: `My photo from ${eventName}`, url });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        if (event?.id) trackAction(event.id, 'photo_shared', { method: 'native' });
        return;
      } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
    if (event?.id) trackAction(event.id, 'photo_shared', { method: 'clipboard' });
  }

  async function handlePrint() {
    if (!photoUrl) return;
    setPrinting(true);
    try {
      const win = window.open('', '_blank', 'width=800,height=600');
      if (win) {
        win.document.write(`<html><head><title>Print Photo</title>
          <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000}
          img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>
          <body><img src="${photoUrl}" onload="setTimeout(function(){window.print();window.close()},300)"/></body></html>`);
        win.document.close();
      }
      if (event?.id && currentPhoto?.id) {
        trackAction(event.id, 'photo_printed', { photoId: currentPhoto.id });
      }
    } finally {
      setTimeout(() => setPrinting(false), 2000);
    }
  }

  async function handleSendEmail() {
    if (!emailInput || !currentPhoto?.id || !event?.id) return;
    setSending(true);
    try {
      await sharePhotoByEmail(currentPhoto.id, emailInput, event.id);
      setEmailSent(true);
      setShowEmailInput(false);
      toast.success('Email sent! 📧');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Email failed');
    } finally {
      setSending(false);
    }
  }

  async function handleSendSMS() {
    if (!phoneInput || !currentPhoto?.id || !event?.id) return;
    setSending(true);
    try {
      await sharePhotoBySMS(currentPhoto.id, phoneInput, event.id);
      setSMSSent(true);
      setShowSMSInput(false);
      toast.success('SMS sent! 💬');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'SMS failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#0a0a0f] overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Photo preview */}
        <div className="relative rounded-2xl overflow-hidden mb-5 shadow-2xl"
          style={{ boxShadow: `0 0 50px ${primaryColor}40` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Your photo" className="w-full object-cover max-h-[45vh]" />
        </div>

        {/* QR code */}
        {qrCode && (
          <div className="bg-white rounded-2xl p-3 mb-4 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="QR code" className="w-24 h-24" />
            <p className="text-black/50 text-[10px] mt-1 text-center">Scan to download on your phone</p>
          </div>
        )}

        {/* Primary: Download */}
        <button onClick={handleDownload} disabled={downloading}
          className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 mb-3 active:scale-95 transition-all"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
          <Download className="w-5 h-5" />
          {downloading ? 'Saving…' : 'Save to Device'}
        </button>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`📸 My photo from ${eventName}! ${galleryUrl || photoUrl}`)}`}
            target="_blank" rel="noreferrer"
            className="py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 bg-[#25D366] active:scale-95 transition-all"
            onClick={() => event?.id && trackAction(event.id, 'photo_shared', { method: 'whatsapp' })}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>

          {/* Native share */}
          <button onClick={handleShare}
            className="py-3 rounded-xl font-semibold text-white/80 text-sm flex items-center justify-center gap-2 bg-white/10 border border-white/15 active:scale-95 transition-all">
            {shared ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {shared ? 'Shared!' : 'Share'}
          </button>
        </div>

        {/* Email row */}
        {allowEmail && (
          <div className="mb-2">
            {showEmailInput ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-2">
                <input
                  type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                  placeholder="your@email.com" autoFocus
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
                <button onClick={handleSendEmail} disabled={sending || !emailInput}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-40">
                  {sending ? '…' : 'Send'}
                </button>
                <button onClick={() => setShowEmailInput(false)} className="px-3 py-2.5 rounded-xl bg-white/10 text-white/50 text-sm">✕</button>
              </motion.div>
            ) : (
              <button
                onClick={() => emailSent ? null : setShowEmailInput(true)}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  emailSent ? 'bg-green-500/20 text-green-400' : 'bg-white/8 border border-white/15 text-white/70 hover:bg-white/12'
                }`}
              >
                {emailSent ? <><Check className="w-4 h-4" /> Email sent!</> : <><Mail className="w-4 h-4" /> Send to Email</>}
              </button>
            )}
          </div>
        )}

        {/* SMS row */}
        {allowSMS && (
          <div className="mb-2">
            {showSMSInput ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-2">
                <input
                  type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendSMS()}
                  placeholder="+1 555 0100" autoFocus
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
                <button onClick={handleSendSMS} disabled={sending || !phoneInput}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
                  {sending ? '…' : 'Send'}
                </button>
                <button onClick={() => setShowSMSInput(false)} className="px-3 py-2.5 rounded-xl bg-white/10 text-white/50 text-sm">✕</button>
              </motion.div>
            ) : (
              <button
                onClick={() => smsSent ? null : setShowSMSInput(true)}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  smsSent ? 'bg-green-500/20 text-green-400' : 'bg-white/8 border border-white/15 text-white/70 hover:bg-white/12'
                }`}
              >
                {smsSent ? <><Check className="w-4 h-4" /> SMS sent!</> : <><MessageSquare className="w-4 h-4" /> Send via SMS</>}
              </button>
            )}
          </div>
        )}

        {/* Print */}
        {allowPrint && (
          <button onClick={handlePrint} disabled={printing}
            className="w-full py-3 rounded-xl font-semibold text-white/70 text-sm flex items-center justify-center gap-2 bg-white/8 border border-white/15 hover:bg-white/12 mb-4 transition-all">
            <Printer className="w-4 h-4" />
            {printing ? 'Opening print…' : 'Print Photo'}
          </button>
        )}

        {/* Done */}
        <button onClick={resetSession}
          className="w-full py-3.5 rounded-xl font-bold text-white/60 text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-white/25 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
          Done — Take Another
        </button>
      </motion.div>
    </div>
  );
}
