'use client';

/**
 * LeadCaptureScreen.tsx
 * Corporate lead generation & survey screen for brand activations and trade shows.
 * Gathers guest details (Name, Email, Phone, Company, Survey Question, Marketing Consent)
 * and stores them in real-time in the backend database.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, Phone, User, CheckCircle2, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';
import { useBoothStore } from '@/lib/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LeadCaptureScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function LeadCaptureScreen({ onComplete, onSkip }: LeadCaptureScreenProps) {
  const event = useBoothStore((s) => s.event);
  const settings = (event?.settings as Record<string, unknown>) || {};

  const requireName = settings.leadRequireName !== false;
  const requireEmail = settings.leadRequireEmail !== false;
  const collectPhone = Boolean(settings.leadRequirePhone);
  const collectCompany = Boolean(settings.leadCollectCompany);
  const surveyQuestion = String(settings.leadSurveyQuestion || '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [surveyAnswer, setSurveyAnswer] = useState('');
  const [consented, setConsented] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (requireName && !name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (requireEmail && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      if (event?.id) {
        await fetch(`${API_BASE}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            company: company.trim(),
            customAnswers: surveyQuestion && surveyAnswer ? { [surveyQuestion]: surveyAnswer } : null,
            consented,
          }),
        });
      }
      onComplete();
    } catch {
      // Continue even if network glitch to avoid stranding guests
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-lg bg-black/70 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-white relative overflow-hidden"
      >
        {/* Header */}
        <div className="text-center space-y-1.5 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> VIP Experience Access
          </div>
          <h2 className="text-2xl font-black tracking-tight">{event?.name || 'Welcome'}</h2>
          <p className="text-white/50 text-xs max-w-xs mx-auto">
            Please enter your information to start your studio photo session
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {requireName && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>
            </div>
          )}

          {requireEmail && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>
            </div>
          )}

          {collectPhone && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>
            </div>
          )}

          {collectCompany && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Company / Organization
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>
            </div>
          )}

          {surveyQuestion && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5">
                {surveyQuestion}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={surveyAnswer}
                  onChange={(e) => setSurveyAnswer(e.target.value)}
                  placeholder="Your response…"
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <HelpCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>
            </div>
          )}

          {/* Opt-in Marketing Checkbox */}
          <label className="flex items-start gap-2.5 pt-1 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
            />
            <span>I agree to receive event photos and occasional brand communications.</span>
          </label>

          {/* Buttons */}
          <div className="pt-2 flex items-center gap-3">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="py-3.5 px-5 rounded-2xl border border-white/15 text-white/60 hover:text-white text-xs font-bold transition-colors"
              >
                Skip
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Begin Studio Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default LeadCaptureScreen;
