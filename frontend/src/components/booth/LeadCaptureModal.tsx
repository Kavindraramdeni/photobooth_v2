'use client';

/**
 * LeadCaptureModal
 *
 * Shown between PreviewScreen and ShareScreen when event.settings.leadCapture = true.
 * Collects name + email. If leadRequired = true, cannot skip.
 *
 * Usage: mount inside BoothScreen controller, between 'preview' and 'share' screens.
 * Check:
 *   const showLead = screen === 'preview' && event?.settings?.leadCapture;
 *   if (showLead) render <LeadCaptureModal onContinue={() => setScreen('share')} />
 *
 * Or — simpler — render it as an overlay on top of PreviewScreen and let it
 * call setScreen('share') when done.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, User, ArrowRight, CheckCircle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { submitLead } from '@/lib/api';
import toast from 'react-hot-toast';

interface LeadCaptureModalProps {
  /** Called when guest clicks "Get My Photo" or "Skip" */
  onContinue: () => void;
}

export function LeadCaptureModal({ onContinue }: LeadCaptureModalProps) {
  const { event, currentPhoto } = useBoothStore();

  const required   = event?.settings?.leadRequired as boolean ?? false;
  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';
  const eventName  = (event?.branding?.eventName as string) || event?.name || 'SnapBooth';

  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setSending(true);
    try {
      await submitLead({
        eventId:  event!.id,
        photoId:  currentPhoto?.id,
        email:    email.trim().toLowerCase(),
        name:     name.trim() || undefined,
        consented: true,
      });
      setDone(true);
      // Brief success flash, then continue to share
      setTimeout(onContinue, 1200);
    } catch {
      // Don't block the guest — log silently and continue
      toast.error('Could not save email — continuing anyway');
      onContinue();
    } finally {
      setSending(false);
    }
  }

  function handleSkip() {
    if (required) return; // skip not allowed when required
    onContinue();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full sm:max-w-md bg-[#111118] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Top handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-white font-black text-xl">Get your photo! 📸</h2>
            <p className="text-white/40 text-sm mt-0.5">
              Enter your email and we'll send it straight to you
            </p>
          </div>
          {!required && (
            <button onClick={handleSkip}
              className="text-white/30 hover:text-white/60 transition-colors p-1 -mt-1 -mr-1">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 pb-8 flex flex-col items-center gap-3 pt-4"
            >
              <CheckCircle className="w-14 h-14 text-green-400" />
              <p className="text-white font-bold text-lg">Sending your way!</p>
              <p className="text-white/40 text-sm">Check your inbox 💌</p>
            </motion.div>
          ) : (
            <motion.div key="form" className="px-6 pb-6 space-y-3">

              {/* Name (optional) */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="given-name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Email (required) */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Your email address *"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="email"
                  inputMode="email"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* GDPR consent note */}
              <p className="text-white/25 text-xs px-1">
                By entering your email you agree to receive your photo from {eventName}.
                We won't spam you.
              </p>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={sending || !email.trim()}
                className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              >
                {sending
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Get My Photo <ArrowRight className="w-5 h-5" /></>
                }
              </motion.button>

              {/* Skip link */}
              {!required && (
                <button onClick={handleSkip}
                  className="w-full text-white/25 hover:text-white/50 text-sm transition-colors py-1">
                  Skip for now
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
