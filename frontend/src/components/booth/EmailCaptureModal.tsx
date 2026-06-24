'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function EmailCaptureModal({ photo, event, isOpen, onClose, onEmailSubmit }: any) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  async function handleSubmit() {
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call backend to send email
      const response = await fetch('/api/photos/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb_access_token')}`,
        },
        body: JSON.stringify({
          email,
          name,
          photoId: photo.id,
          eventId: event.id,
          shortCode: photo.short_code,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setSubmitted(true);
      toast.success('Photo sent to your email!');

      // Call callback
      if (onEmailSubmit) {
        onEmailSubmit({ email, name });
      }

      // Close modal after 3 seconds
      setTimeout(() => {
        onClose();
        setEmail('');
        setName('');
        setSubmitted(false);
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to send email');
      toast.error(error.message || 'Email send failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0d0d1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full"
          >
            {!submitted ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-violet-500/20 rounded-full mx-auto mb-4">
                  <Mail className="w-6 h-6 text-violet-300" />
                </div>

                <h3 className="text-white font-bold text-lg text-center mb-2">Get Your Photo</h3>
                <p className="text-zinc-400 text-sm text-center mb-6">
                  We'll send your photo to your email so you can save and share it!
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => {
                        setName(e.target.value);
                        setError('');
                      }}
                      placeholder="Your name"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold disabled:opacity-50 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/20 rounded-full mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Email Sent!</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Check your inbox for your photo. It will expire in 30 days.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
