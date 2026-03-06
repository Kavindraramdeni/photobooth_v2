'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Star, Building2, Camera, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    icon: <Camera className="w-6 h-6" />,
    color: '#3b82f6',
    tagline: 'Perfect for solo operators',
    features: [
      '1 active event at a time',
      '500 photos / month',
      'QR code instant sharing',
      'Basic AI filters (6 styles)',
      '7-day photo gallery',
      'WhatsApp & Instagram sharing',
      'Branded overlays',
    ],
    missing: ['Generative AI images', 'GIF & Boomerang', 'Analytics dashboard', 'White-label'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 79,
    icon: <Star className="w-6 h-6" />,
    color: '#7c3aed',
    tagline: 'For growing event businesses',
    popular: true,
    features: [
      'Unlimited events',
      '5,000 photos / month',
      'AI generative images (HuggingFace)',
      'GIF & Boomerang mode',
      '4-photo strip mode',
      '30-day photo gallery',
      'Analytics dashboard',
      'Custom branding per event',
      'QR + WhatsApp + Instagram sharing',
    ],
    missing: ['White-label', 'Multi-operator seats'],
  },
  {
    key: 'business',
    name: 'Business',
    price: 149,
    icon: <Building2 className="w-6 h-6" />,
    color: '#f59e0b',
    tagline: 'For agencies & rental companies',
    features: [
      'Everything in Pro',
      'Unlimited photos',
      'White-label (your own brand)',
      'Multi-operator seats',
      '90-day photo gallery',
      'Priority support',
      'Custom domain support',
      'Advanced analytics',
    ],
    missing: [],
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [showForm, setShowForm] = useState<string | null>(null);

  async function handleSubscribe(planKey: string) {
    if (!email || !name) {
      setShowForm(planKey);
      return;
    }

    setLoading(planKey);
    try {
      const res = await api.post('/billing/checkout', { planKey, operatorEmail: email, operatorName: name });
      window.location.href = res.data.checkoutUrl;
    } catch (e) {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handlePayPerEvent() {
    if (!email || !name) {
      setShowForm('per_event');
      return;
    }

    setLoading('per_event');
    try {
      const res = await api.post('/billing/checkout/event', { operatorEmail: email, operatorName: name, eventName: 'Single Event' });
      window.location.href = res.data.checkoutUrl;
    } catch (e) {
      toast.error('Failed to start checkout.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#060610] text-white overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">SnapBooth AI</span>
        </div>
        <a href="/dashboard" className="text-white/50 hover:text-white text-sm transition-colors">
          Already subscribed? Sign in →
        </a>
      </nav>

      {/* Hero */}
      <div className="text-center pt-20 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          7-day free trial on all plans — no card required
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-5xl md:text-6xl font-black tracking-tight mb-4"
        >
          Simple, transparent pricing.
          <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }}>
            Built for event pros.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-white/50 text-xl max-w-xl mx-auto"
        >
          AI-powered photobooth software that your clients will love.
          One tool, every event.
        </motion.p>
      </div>

      {/* Email capture form (shown when clicking a plan without entering email) */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-[#12121a] border border-white/10 rounded-2xl p-8 w-full max-w-md"
          >
            <h3 className="text-xl font-bold mb-1">Start your free trial</h3>
            <p className="text-white/50 text-sm mb-6">7 days free, then ${PLANS.find(p => p.key === showForm)?.price ?? 19}/month</p>

            <div className="space-y-3 mb-6">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { setShowForm(null); showForm === 'per_event' ? handlePayPerEvent() : handleSubscribe(showForm); }}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Plans grid */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-2xl border p-7 flex flex-col
                ${plan.popular
                  ? 'border-purple-500 bg-purple-950/30'
                  : 'border-white/10 bg-white/3'
                }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wide">
                  MOST POPULAR
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}22`, color: plan.color }}>
                  {plan.icon}
                </div>
                <div>
                  <div className="font-bold text-lg">{plan.name}</div>
                  <div className="text-white/40 text-xs">{plan.tagline}</div>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-5xl font-black">${plan.price}</span>
                <span className="text-white/40 ml-1">/month</span>
                <div className="text-green-400 text-sm mt-1 font-medium">✓ 7-day free trial</div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-white/80">{f}</span>
                  </li>
                ))}
                {plan.missing.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm opacity-35">
                    <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center">—</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.key)}
                disabled={loading === plan.key}
                className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                style={plan.popular
                  ? { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {loading === plan.key ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Start free trial <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Pay per event */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-white/3"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-lg">Pay Per Event</div>
              <div className="text-white/50 text-sm">Just testing the waters? One event, no commitment.</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-3xl font-black">$19</span>
              <span className="text-white/40 ml-1">/ event</span>
            </div>
            <button
              onClick={handlePayPerEvent}
              disabled={loading === 'per_event'}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold hover:bg-amber-500/25 transition-all"
            >
              {loading === 'per_event' ? 'Loading...' : 'Buy Single Event'}
            </button>
          </div>
        </motion.div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 text-white/30 text-sm">
          {['✓ No contracts', '✓ Cancel anytime', '✓ 7-day free trial', '✓ Works on any device', '✓ Instant setup'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
