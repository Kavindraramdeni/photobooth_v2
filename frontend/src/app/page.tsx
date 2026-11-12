'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  Check,
  Play,
  Sparkles,
  QrCode,
  Share2,
  BarChart3,
  ShieldCheck,
  Wand2,
  Users,
  Smartphone,
  Tablet,
  Printer,
  ChevronRight,
  Layers,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: <Wand2 className="w-5 h-5 text-purple-600" />,
    title: 'AI Studio Engine',
    desc: 'Transform guests into cinematic characters, watercolor paintings, or branded avatars with real-time neural filters.',
    badge: 'Trending',
  },
  {
    icon: <QrCode className="w-5 h-5 text-emerald-600" />,
    title: 'Sub-Second QR Delivery',
    desc: 'Every capture gets a unique QR session link for instant, zero-contact photo retrieval directly to mobile devices.',
    badge: 'Lightning Fast',
  },
  {
    icon: <Share2 className="w-5 h-5 text-sky-600" />,
    title: 'Instant Social Sharing',
    desc: 'One-tap dispatch to WhatsApp, AirDrop, Instagram Stories, SMS, and high-resolution direct email.',
    badge: 'Omnichannel',
  },
  {
    icon: <Tablet className="w-5 h-5 text-indigo-600" />,
    title: 'Apple Light Touch Kiosk',
    desc: 'High-FPS camera viewfinder with animated countdown rings, custom frame overlays, and seamless iPad touch UX.',
    badge: 'Hardware Ready',
  },
  {
    icon: <Layers className="w-5 h-5 text-fuchsia-600" />,
    title: '5-Hub Operations Suite',
    desc: 'LiveOps monitoring, Live Kiosk iPad Simulator, print queues, lead capture analytics, and photo moderation.',
    badge: 'Pro Ops',
  },
  {
    icon: <Printer className="w-5 h-5 text-amber-600" />,
    title: 'Universal AirPrint & DNP',
    desc: 'Instant background printing to AirPrint, DNP, and wireless dye-sub printers with no blank pages or scale drift.',
    badge: 'Plug & Play',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8f9fc] text-slate-900 overflow-x-hidden selection:bg-purple-500/20 selection:text-purple-700">
      {/* Background Ambient Mesh */}
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[140px] bg-purple-500/10 mix-blend-multiply" />
          <div className="absolute top-[35%] -left-40 h-[500px] w-[500px] rounded-full blur-[140px] bg-indigo-500/10" />
          <div className="absolute top-[25%] -right-40 h-[550px] w-[550px] rounded-full blur-[160px] bg-fuchsia-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(#00000006_1px,transparent_1px)] [background-size:28px_28px]" />
        </div>

        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-black/5 glass-crystal">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center font-black text-white shadow-lg shadow-purple-600/30">
                S
              </div>
              <span className="font-black tracking-tight text-xl text-slate-900">
                SnapBooth <span className="text-purple-600 font-semibold">AI</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm text-slate-600 font-bold">
              <a href="#features" className="hover:text-purple-600 transition">Features</a>
              <Link href="/pricing" className="hover:text-purple-600 transition">Pricing</Link>
              <Link href="/admin" className="hover:text-purple-600 transition">Admin Hub</Link>
              <Link href="/booth?event=snapbooth-demo" className="hover:text-purple-600 transition">Live Kiosk</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-purple-600/25 transition-all active:scale-95"
              >
                Launch Free Booth
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full glass-crystal-pill px-4 py-1.5 text-purple-700 text-xs font-black shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Clean Apple Light Studio Photobooth</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.04] tracking-tight text-slate-900">
              Turn Events Into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 drop-shadow-sm">
                Viral Memories.
              </span>
            </h1>

            <p className="text-lg text-slate-600 max-w-xl leading-relaxed font-medium">
              Apple-grade tactile iPad touch booths, AI studio transformations, sub-second QR delivery, and an operator suite built to outperform Snappic, Simple Booth, and Touchpix.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-600/30 transition-all active:scale-95 btn-arcade"
              >
                <span>Launch Your Event</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/booth?event=snapbooth-demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base glass-crystal border border-black/5 hover:border-black/15 text-slate-800 transition-all active:scale-95 shadow-md"
              >
                <Play className="w-4 h-4 fill-current text-purple-600" />
                <span>Test Live iPad Booth</span>
              </Link>
            </div>

            {/* Social Proof Badges */}
            <div className="pt-6 flex items-center gap-6 text-xs text-slate-500 font-bold">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" /> No credit card needed
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" /> Works on any iPad or laptop
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" /> Offline queue auto-sync
              </div>
            </div>
          </motion.div>

          {/* Device Showcase Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative mx-auto rounded-[42px] bg-[#e2e8f0] border-4 border-[#cbd5e1] p-4 shadow-[0_24px_80px_-15px_rgba(0,0,0,0.15)]">
              {/* Virtual Device Bezel */}
              <div className="rounded-[30px] overflow-hidden bg-gradient-to-b from-[#ffffff] via-[#f8fafd] to-[#eef2f8] border border-black/5 relative aspect-[9/14] flex flex-col justify-between p-5 text-slate-900">
                {/* Simulated Kiosk Header */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-black">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>BOOTH READY</span>
                  </div>
                  <div className="w-7 h-7 rounded-xl glass-crystal-pill flex items-center justify-center text-xs shadow-sm">⚙️</div>
                </div>

                {/* Hero Showcase Photo */}
                <div className="text-center my-auto z-10 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mx-auto text-2xl text-white shadow-lg shadow-purple-600/30">
                    ✨
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Gala Celebration 2026</h3>
                  <p className="text-slate-500 text-xs font-bold">Touch any mode below to start</p>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { label: 'Photo', icon: '📸', color: 'from-blue-600 to-indigo-600' },
                      { label: '4-Strip', icon: '🎞️', color: 'from-fuchsia-600 to-purple-600' },
                      { label: 'AI Magic', icon: '✨', color: 'from-purple-600 to-pink-600' },
                    ].map(btn => (
                      <div
                        key={btn.label}
                        className="p-3 rounded-2xl glass-crystal text-center flex flex-col items-center gap-1.5 shadow-md"
                      >
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${btn.color} flex items-center justify-center text-xs text-white shadow-sm`}>
                          {btn.icon}
                        </div>
                        <span className="text-[10px] font-black text-slate-900">{btn.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer branding */}
                <div className="text-center text-[10px] text-slate-400 font-black tracking-wider uppercase z-10">
                  SnapBooth Apple Light Studio
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-black/5">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
              Engineered to Surpass Every Competitor.
            </h2>
            <p className="text-slate-600 text-base max-w-2xl mx-auto font-medium">
              Benchmarked against Snappic, Simple Booth (HALO), Touchpix, Salsa, and Booth.events. SnapBooth AI delivers unprecedented speed, beauty, and operational control.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-3xl glass-crystal p-8 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-black/5"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-900/5 text-purple-700">
                    {feature.badge}
                  </span>
                </div>
                <h3 className="font-black text-xl text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          <div className="rounded-[36px] bg-gradient-to-br from-purple-700 via-indigo-700 to-purple-900 text-white p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h3 className="text-3xl sm:text-5xl font-black tracking-tight">
                Ready to Upgrade Your Booth Experience?
              </h3>
              <p className="text-purple-100 text-base font-medium">
                Set up your first event in less than 2 minutes. Free trial included with full access to AI styles, live iPad simulator, and instant sharing.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-2xl font-black text-base bg-white text-purple-900 hover:bg-white/95 shadow-2xl transition-all active:scale-95"
                >
                  Create Free Event Now →
                </Link>
                <Link
                  href="/booth?event=snapbooth-demo"
                  className="px-8 py-4 rounded-2xl font-bold text-base bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md border border-white/20"
                >
                  Open Live Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-black/5 py-12 bg-white">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-semibold">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-purple-600 flex items-center justify-center font-black text-white text-xs">
                S
              </div>
              <span className="font-black text-slate-900 text-sm">SnapBooth AI</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-purple-600 transition">Privacy</Link>
              <Link href="/terms" className="hover:text-purple-600 transition">Terms</Link>
              <Link href="/admin" className="hover:text-purple-600 transition">Admin Hub</Link>
              <a href="https://github.com/Kavindraramdeni/photobooth_v2" target="_blank" rel="noreferrer" className="hover:text-purple-600 transition">GitHub</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
