'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ─── Plan definitions (mirrors backend PLANS) ─────────────────────────────────
const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Try it out',
    badge: null,
    color: 'from-zinc-500 to-zinc-600',
    border: 'border-white/10',
    features: {
      events: '2 events / month',
      photos: '100 photos / month',
      gallery: '3-day gallery',
      ai_filters: false,
      ai_generative: false,
      gif_boomerang: false,
      strip_mode: false,
      branding: false,
      analytics: false,
      webhook: false,
      white_label: false,
      support: 'Community',
    },
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    tagline: 'Solo operators & freelancers',
    badge: null,
    color: 'from-blue-500 to-blue-700',
    border: 'border-blue-500/30',
    features: {
      events: '5 events / month',
      photos: '500 photos / month',
      gallery: '7-day gallery',
      ai_filters: true,
      ai_generative: false,
      gif_boomerang: true,
      strip_mode: false,
      branding: true,
      analytics: false,
      webhook: false,
      white_label: false,
      support: 'Email',
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 79,
    tagline: 'Growing event businesses',
    badge: 'MOST POPULAR',
    color: 'from-violet-600 to-purple-700',
    border: 'border-violet-500/60',
    features: {
      events: 'Unlimited events',
      photos: '5,000 photos / month',
      gallery: '30-day gallery',
      ai_filters: true,
      ai_generative: true,
      gif_boomerang: true,
      strip_mode: true,
      branding: true,
      analytics: true,
      webhook: true,
      white_label: false,
      support: 'Priority email',
    },
  },
  {
    key: 'business',
    name: 'Business',
    price: 149,
    tagline: 'Agencies & rental companies',
    badge: null,
    color: 'from-amber-500 to-orange-600',
    border: 'border-amber-500/30',
    features: {
      events: 'Unlimited events',
      photos: 'Unlimited photos',
      gallery: '90-day gallery',
      ai_filters: true,
      ai_generative: true,
      gif_boomerang: true,
      strip_mode: true,
      branding: true,
      analytics: true,
      webhook: true,
      white_label: true,
      support: 'Dedicated support',
    },
  },
];

type PlanFeatures = typeof PLANS[0]['features'];
type FeatureKey = keyof PlanFeatures;

const FEATURE_ROWS: { key: FeatureKey; label: string; type: 'text' | 'bool' }[] = [
  { key: 'events',        label: 'Events per month',     type: 'text' },
  { key: 'photos',        label: 'Photos per month',     type: 'text' },
  { key: 'gallery',       label: 'Gallery retention',    type: 'text' },
  { key: 'ai_filters',    label: 'AI photo filters',     type: 'bool' },
  { key: 'ai_generative', label: 'Generative AI images', type: 'bool' },
  { key: 'gif_boomerang', label: 'GIF & Boomerang mode', type: 'bool' },
  { key: 'strip_mode',    label: '4-photo strip mode',   type: 'bool' },
  { key: 'branding',      label: 'Custom branding',      type: 'bool' },
  { key: 'analytics',     label: 'Analytics dashboard',  type: 'bool' },
  { key: 'webhook',       label: 'Webhook / Zapier',     type: 'bool' },
  { key: 'white_label',   label: 'White-label',          type: 'bool' },
  { key: 'support',       label: 'Support',              type: 'text' },
];

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function CrossIcon() {
  return <span className="block w-4 h-px bg-white/20 mx-auto mt-2.5" />;
}

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/billing/my-plan').then(r => setCurrentPlan(r.data.plan)).catch(() => {});
    }
  }, [user]);

  async function handleSubscribe(planKey: string) {
    if (planKey === 'free') return;
    if (!user) { router.push('/login?from=/pricing'); return; }
    if (currentPlan === planKey) { toast('You are already on this plan'); return; }
    setLoading(planKey);
    try {
      const res = await api.post('/billing/checkout', { planKey, isAnnual: annual });
      window.location.href = res.data.checkoutUrl;
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const dp = (price: number) => annual ? Math.round(price * 0.8) : price;

  return (
    <div className="min-h-screen bg-[#07070f] text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.15]"
          style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center font-black text-sm">S</div>
          <span className="font-bold text-lg">SnapBooth AI</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <Link href="/admin" className="text-white/50 hover:text-white transition">Dashboard →</Link>
          ) : (
            <>
              <Link href="/login" className="text-white/50 hover:text-white transition">Sign in</Link>
              <Link href="/signup" className="bg-white/8 hover:bg-white/12 border border-white/10 px-4 py-2 rounded-lg transition">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-32">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-6">
            ✦ 7-day free trial · No credit card required
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none mb-4">
            Pricing that scales
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              with your events.
            </span>
          </h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto mb-8">
            AI-powered photobooth software with real features at half the industry price.
          </p>
          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm transition ${!annual ? 'text-white' : 'text-white/40'}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? 'bg-violet-600' : 'bg-white/10'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${annual ? 'translate-x-5' : ''}`} />
            </button>
            <span className={`text-sm transition ${annual ? 'text-white' : 'text-white/40'}`}>
              Annual <span className="text-green-400 font-bold">−20%</span>
            </span>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.key;
            const isPopular = plan.badge === 'MOST POPULAR';
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`relative rounded-2xl border flex flex-col overflow-hidden ${plan.border} ${isPopular ? 'bg-violet-950/40' : 'bg-white/[0.025]'}`}
              >
                {plan.badge && (
                  <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[10px] font-black tracking-widest text-center py-1.5">
                    {plan.badge}
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="mb-5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center font-black text-xs mb-3`}>
                      {plan.name[0]}
                    </div>
                    <div className="font-bold text-lg">{plan.name}</div>
                    <div className="text-white/35 text-xs mt-0.5">{plan.tagline}</div>
                  </div>

                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <div className="text-4xl font-black">Free</div>
                    ) : (
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black">${dp(plan.price)}</span>
                        <span className="text-white/30 mb-1 text-sm">/mo</span>
                      </div>
                    )}
                    {plan.price > 0 && (
                      <div className="text-white/25 text-xs mt-1.5">
                        {annual ? `$${dp(plan.price) * 12}/yr · ` : ''}7-day free trial
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1 text-sm">
                    {[
                      plan.features.events,
                      plan.features.photos,
                      plan.features.gallery,
                      plan.features.ai_generative ? 'Generative AI images' : null,
                      plan.features.analytics ? 'Analytics dashboard' : null,
                      plan.features.white_label ? 'White-label' : null,
                      !plan.features.ai_filters ? '— No AI filters' : null,
                    ].filter((f): f is string => Boolean(f)).slice(0, 5).map(f => (
                      <li key={f as string} className={`flex items-center gap-2 ${(f as string).startsWith('—') ? 'text-white/20' : 'text-white/60'}`}>
                        {!(f as string).startsWith('—') && <span className="text-violet-400 text-xs">→</span>}
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-bold text-center tracking-wide">
                      ✓ CURRENT PLAN
                    </div>
                  ) : plan.price === 0 ? (
                    <Link href="/signup"
                      className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/60 text-sm font-semibold text-center block transition">
                      Get started free
                    </Link>
                  ) : (
                    <button onClick={() => handleSubscribe(plan.key)} disabled={loading === plan.key}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white'
                          : 'bg-white/6 hover:bg-white/10 border border-white/10 text-white'
                      }`}>
                      {loading === plan.key
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : 'Start free trial →'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Compare toggle */}
        <div className="text-center mb-4">
          <button onClick={() => setShowTable(!showTable)}
            className="text-sm text-white/35 hover:text-white/60 transition underline underline-offset-4">
            {showTable ? 'Hide full comparison ↑' : 'Compare all features ↓'}
          </button>
        </div>

        {/* Comparison table */}
        <AnimatePresence>
          {showTable && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-12">
              <div className="rounded-2xl border border-white/8 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.02]">
                      <th className="text-left px-5 py-4 text-white/35 font-medium w-48">Feature</th>
                      {PLANS.map(p => (
                        <th key={p.key} className="px-4 py-4 text-center font-black">
                          <span className={`text-transparent bg-clip-text bg-gradient-to-br ${p.color}`}>{p.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_ROWS.map((row, i) => (
                      <tr key={row.key} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                        <td className="px-5 py-3 text-white/50">{row.label}</td>
                        {PLANS.map(p => (
                          <td key={p.key} className="px-4 py-3 text-center">
                            {row.type === 'bool'
                              ? (p.features[row.key] ? <CheckIcon /> : <CrossIcon />)
                              : <span className="text-white/60 text-xs">{p.features[row.key] as string}</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pay per event */}
        <div className="border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02] mb-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">⚡</div>
            <div>
              <div className="font-bold">Pay Per Event</div>
              <div className="text-white/35 text-sm">No subscription. Full Pro features for 24 hours. Perfect for testing.</div>
            </div>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div><span className="text-3xl font-black">$19</span><span className="text-white/30 ml-1 text-sm">/ event</span></div>
            <button onClick={() => handleSubscribe('per_event')} disabled={loading === 'per_event'}
              className="px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 font-semibold hover:bg-amber-500/18 transition text-sm whitespace-nowrap">
              {loading === 'per_event' ? 'Loading...' : 'Buy single event'}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Common questions</h2>
          {[
            { q: "What happens after the free trial?", a: "You'll be charged your chosen plan amount. Cancel any time before the trial ends and you won't be billed." },
            { q: "Can I upgrade or downgrade anytime?", a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing period." },
            { q: "What counts as a photo?", a: "Every captured photo, GIF, boomerang, or strip counts as one photo against your monthly quota." },
            { q: "Does the Free plan need a credit card?", a: "No. Free plan requires no payment details." },
            { q: "What is white-label?", a: "Business plan users can remove all SnapBooth AI branding and replace it with their own logo and name — clients never know the platform you use." },
          ].map(({ q, a }) => (
            <details key={q} className="border-b border-white/8 py-4 group cursor-pointer">
              <summary className="font-medium text-white/75 hover:text-white transition list-none flex items-center justify-between">
                {q} <span className="text-white/25 transition-transform group-open:rotate-180 inline-block">↓</span>
              </summary>
              <p className="mt-3 text-white/40 text-sm leading-relaxed">{a}</p>
            </details>
          ))}
        </div>

        {/* Trust */}
        <div className="flex flex-wrap justify-center gap-8 text-white/15 text-xs tracking-widest font-medium">
          {['NO CONTRACTS', 'CANCEL ANYTIME', '7-DAY FREE TRIAL', 'WORKS ON ANY DEVICE', 'INSTANT SETUP'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
