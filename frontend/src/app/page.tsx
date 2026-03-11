'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Camera, Sparkles, QrCode, Share2, BarChart3, Zap,
  ArrowRight, Check, ChevronDown, Play, Star
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '#features', label: 'Features' },
];

const MODES = [
  { icon: '📸', label: 'Single photo', desc: 'Classic portrait shots with AI filter overlays' },
  { icon: '🎞️', label: '4-photo strip', desc: 'Film strip layout printed in seconds' },
  { icon: '🎬', label: 'GIF mode', desc: 'Animated GIFs guests can share instantly' },
  { icon: '⏪', label: 'Boomerang', desc: 'Looping video moments like Instagram' },
];

const FEATURES = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-violet-500 to-purple-600',
    title: 'AI Photo Styles',
    desc: 'Transform every shot with anime, vintage, watercolor, cyberpunk and more — powered by HuggingFace.',
  },
  {
    icon: <QrCode className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-500',
    title: 'Instant QR Delivery',
    desc: 'Every photo gets a unique QR code. Guests scan and download in under 3 seconds.',
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-600',
    title: 'WhatsApp & Instagram',
    desc: 'One-tap sharing to WhatsApp, Instagram Stories, or download — guests love it.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-500',
    title: 'Live Analytics',
    desc: 'Real-time dashboard — see photos taken, shares, prints, and engagement as it happens.',
  },
  {
    icon: <Camera className="w-5 h-5" />,
    color: 'from-pink-500 to-rose-600',
    title: 'Custom Branding',
    desc: 'Add your logo, brand colors, and overlay text. Every photo becomes branded content.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    color: 'from-indigo-500 to-violet-600',
    title: 'Webhook & Zapier',
    desc: 'Auto-send leads to your CRM, trigger emails, and connect to 5000+ apps via Zapier.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Priya R.',
    role: 'Wedding photographer',
    avatar: 'P',
    color: 'bg-pink-500',
    text: 'Guests were obsessed. The AI filters made everyone look incredible and the QR sharing meant zero follow-up chasing.',
    stars: 5,
  },
  {
    name: 'Marcus T.',
    role: 'Corporate events',
    avatar: 'M',
    color: 'bg-blue-500',
    text: 'We run 20+ events a month. SnapBooth paid for itself after the first event. The analytics dashboard is a game changer.',
    stars: 5,
  },
  {
    name: 'Aisha K.',
    role: 'Event rental company',
    avatar: 'A',
    color: 'bg-violet-500',
    text: 'White-label means our clients think it\'s our own platform. The business plan is genuinely worth every rupee.',
    stars: 5,
  },
];

const COMPARE = [
  { feature: 'AI photo filters',    snapbooth: true,  others: false },
  { feature: 'GIF & Boomerang',     snapbooth: true,  others: 'Paid add-on' },
  { feature: 'Instant QR delivery', snapbooth: true,  others: true },
  { feature: 'Analytics dashboard', snapbooth: true,  others: false },
  { feature: 'Webhook / Zapier',    snapbooth: true,  others: false },
  { feature: 'White-label',         snapbooth: true,  others: 'Enterprise only' },
  { feature: 'Starting price',      snapbooth: 'Free','others': '$49/mo' },
];

function Tick() {
  return <span className="text-green-400">✓</span>;
}
function Cross() {
  return <span className="text-white/20">—</span>;
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <main className="min-h-screen bg-[#06060e] text-white overflow-x-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${
        scrolled ? 'border-b border-white/8 bg-[#06060e]/90 backdrop-blur-md' : ''
      }`}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center font-black text-sm">S</div>
          <span className="font-bold text-lg tracking-tight">SnapBooth AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-white/50 hover:text-white transition">{l.label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:block text-sm text-white/50 hover:text-white transition">Sign in</Link>
          <Link href="/signup"
            className="text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold px-4 py-2 rounded-lg transition">
            Start free →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center pt-24">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.12]"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/4 w-[350px] h-[350px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-violet-300 text-xs font-medium tracking-wide">AI-Powered Photobooth Platform</span>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02] mb-6">
            The photobooth that
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400">
              runs itself.
            </span>
          </h1>

          <p className="text-white/45 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            AI filters, instant QR sharing, GIFs, boomerangs, analytics — everything your clients expect,
            in one platform that costs half of what competitors charge.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup"
              className="group flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-4 rounded-xl transition-all text-base shadow-lg shadow-violet-500/20">
              Start for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/booth"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-8 py-4 rounded-xl transition-all text-base">
              <Play className="w-4 h-4 fill-current" />
              See live demo
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/30">
            <span>✓ No credit card required</span>
            <span>✓ 7-day free trial</span>
            <span>✓ Setup in 2 minutes</span>
          </div>
        </motion.div>

        {/* Scroll */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20">
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </motion.div>
      </section>

      {/* ── Booth modes ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">4 modes. One booth.</h2>
          <p className="text-white/40">Every way guests want to capture the moment — built in.</p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {MODES.map((m, i) => (
            <motion.div key={m.label}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 text-center hover:bg-white/[0.06] transition-colors group">
              <div className="text-3xl mb-3">{m.icon}</div>
              <div className="font-semibold text-sm mb-1.5">{m.label}</div>
              <div className="text-white/35 text-xs leading-relaxed">{m.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Everything included.</h2>
          <p className="text-white/40 max-w-xl mx-auto">No plugins, no add-ons, no surprises. Every feature is built in from day one.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              className="bg-white/[0.025] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.05] transition-colors">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 text-white`}>
                {f.icon}
              </div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <h2 className="text-3xl font-black mb-3">Half the price. Twice the features.</h2>
          <p className="text-white/40">See how SnapBooth AI compares to legacy photobooth platforms.</p>
        </motion.div>
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                <th className="text-left px-5 py-3.5 text-white/40 font-medium">Feature</th>
                <th className="px-4 py-3.5 text-center font-black text-violet-400">SnapBooth AI</th>
                <th className="px-4 py-3.5 text-center text-white/30 font-medium">Others</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                  <td className="px-5 py-3 text-white/60">{row.feature}</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {row.snapbooth === true ? <Tick /> : <span className="text-violet-400 text-xs font-bold">{row.snapbooth}</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-white/30 text-xs">
                    {row.others === true ? <Tick /> : row.others === false ? <Cross /> : row.others}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3">Loved by event professionals</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
              <div className="flex gap-0.5 mb-4">
                {[...Array(t.stars)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-5">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center text-xs font-bold`}>{t.avatar}</div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-white/35 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center bg-gradient-to-b from-violet-600/15 via-violet-600/8 to-transparent border border-violet-500/20 rounded-3xl p-12">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-3xl font-black mb-3">Ready for your first event?</h2>
          <p className="text-white/40 mb-8">Free forever. No card needed. Your first event is on us.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-8 text-left max-w-sm mx-auto">
            {['AI photo filters', 'Instant QR sharing', 'GIF & Boomerang', 'Live analytics', 'Custom branding', 'WhatsApp sharing'].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-white/55">
                <Check className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup"
              className="group flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/20">
              Create free account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/pricing" className="text-white/35 hover:text-white text-sm transition">
              View pricing →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center font-black text-xs">S</div>
            <span className="text-white/40 text-sm font-semibold">SnapBooth AI</span>
          </div>
          <div className="flex items-center gap-8 text-white/25 text-sm">
            <Link href="/pricing"      className="hover:text-white/60 transition">Pricing</Link>
            <Link href="/admin"        className="hover:text-white/60 transition">Dashboard</Link>
            <Link href="/booth"        className="hover:text-white/60 transition">Live Demo</Link>
            <Link href="/login"        className="hover:text-white/60 transition">Sign in</Link>
            <Link href="/signup"       className="hover:text-white/60 transition">Sign up</Link>
          </div>
          <p className="text-white/15 text-xs">© {new Date().getFullYear()} SnapBooth AI</p>
        </div>
      </footer>
    </main>
  );
}
