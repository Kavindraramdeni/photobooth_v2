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
    icon: <Wand2 className="w-5 h-5 text-purple-400" />,
    title: 'AI Studio Engine',
    desc: 'Transform guests into cinematic characters, watercolor paintings, or branded avatars with real-time neural filters.',
    badge: 'Trending',
  },
  {
    icon: <QrCode className="w-5 h-5 text-emerald-400" />,
    title: 'Sub-Second QR Delivery',
    desc: 'Every capture gets a unique QR session link for instant, zero-contact photo retrieval directly to mobile devices.',
    badge: 'Lightning Fast',
  },
  {
    icon: <Share2 className="w-5 h-5 text-sky-400" />,
    title: 'Instant Social Sharing',
    desc: 'One-tap dispatch to WhatsApp, AirDrop, Instagram Stories, SMS, and high-resolution direct email.',
    badge: 'Omnichannel',
  },
  {
    icon: <Tablet className="w-5 h-5 text-indigo-400" />,
    title: 'Arcade Tactile Touch Kiosk',
    desc: 'High-FPS camera viewfinder with animated countdown rings, custom frame overlays, and seamless iPad touch UX.',
    badge: 'Hardware Ready',
  },
  {
    icon: <Layers className="w-5 h-5 text-fuchsia-400" />,
    title: '5-Hub Operations Dashboard',
    desc: 'LiveOps monitoring, Live Kiosk iPad Simulator, print queues, lead capture analytics, and photo moderation.',
    badge: 'Pro Ops',
  },
  {
    icon: <Printer className="w-5 h-5 text-amber-400" />,
    title: 'Universal AirPrint & DNP',
    desc: 'Instant background printing to AirPrint, DNP, and wireless dye-sub printers with no blank pages or scale drift.',
    badge: 'Plug & Play',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07070d] text-white overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200">
      {/* Background Ambient Mesh */}
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[140px] bg-purple-600/20 mix-blend-screen" />
          <div className="absolute top-[35%] -left-40 h-[500px] w-[500px] rounded-full blur-[140px] bg-indigo-600/15" />
          <div className="absolute top-[25%] -right-40 h-[550px] w-[550px] rounded-full blur-[160px] bg-fuchsia-600/15" />
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:28px_28px] opacity-50" />
        </div>

        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-white/10 glass-panel">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center font-black text-white shadow-lg shadow-purple-500/30">
                S
              </div>
              <span className="font-black tracking-tight text-xl text-white">SnapBooth <span className="text-purple-400 font-medium">AI</span></span>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm text-white/70 font-semibold">
              <a href="#features" className="hover:text-white transition">Features</a>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/admin" className="hover:text-white transition">Admin Hub</Link>
              <Link href="/booth?event=snapbooth-demo" className="hover:text-white transition">Live Kiosk</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-bold text-white/70 hover:text-white px-3 py-2">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-black shadow-lg shadow-purple-600/30 transition-all active:scale-95"
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
            <div className="inline-flex items-center gap-2 rounded-full glass-pill px-4 py-1.5 text-purple-300 text-xs font-bold border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>The Next-Gen Photobooth SaaS Experience</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.04] tracking-tight">
              Turn Events Into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 drop-shadow">
                Viral Memories.
              </span>
            </h1>

            <p className="text-lg text-white/70 max-w-xl leading-relaxed font-normal">
              Arcade-grade tactile iPad booths, AI style transformations, sub-second QR delivery, and an Apple-level operations suite designed to dominate event entertainment.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-purple-600/30 transition-all active:scale-95"
              >
                <span>Launch Your Event</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/booth?event=snapbooth-demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base glass-panel border border-white/15 hover:border-white/30 text-white transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current text-purple-400" />
                <span>Test Live iPad Booth</span>
              </Link>
            </div>

            {/* Social Proof Badges */}
            <div className="pt-6 flex items-center gap-6 text-xs text-white/50 font-semibold">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" /> No credit card needed
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" /> Works on any iPad or laptop
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" /> Offline queue sync
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
            <div className="relative mx-auto rounded-[40px] bg-[#1a1a24] border-4 border-[#2d2d3d] p-4 shadow-[0_24px_80px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)]">
              {/* Virtual Device Bezel */}
              <div className="rounded-[28px] overflow-hidden bg-[#07070d] border border-white/10 relative aspect-[9/14] flex flex-col justify-between p-5">
                {/* Simulated Kiosk Header */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Booth Ready</span>
                  </div>
                  <div className="w-7 h-7 rounded-xl glass-pill flex items-center justify-center text-xs">⚙️</div>
                </div>

                {/* Hero Showcase Photo */}
                <div className="text-center my-auto z-10 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto text-2xl shadow-lg">
                    ✨
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Gala Celebration 2026</h3>
                  <p className="text-white/50 text-xs">Touch any mode below to start</p>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { label: 'Photo', icon: '📸', color: 'from-blue-600 to-indigo-600' },
                      { label: '4-Strip', icon: '🎞️', color: 'from-fuchsia-600 to-purple-600' },
                      { label: 'AI Magic', icon: '✨', color: 'from-purple-600 to-pink-600' },
                    ].map(btn => (
                      <div
                        key={btn.label}
                        className="p-3 rounded-2xl glass-panel border border-white/10 text-center flex flex-col items-center gap-1.5 shadow-md"
                      >
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${btn.color} flex items-center justify-center text-xs text-white`}>
                          {btn.icon}
                        </div>
                        <span className="text-[10px] font-bold text-white">{btn.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer branding */}
                <div className="text-center text-[10px] text-white/30 font-semibold tracking-wider uppercase z-10">
                  SnapBooth AI Touch Kiosk
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/10">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Engineered to Surpass Every Competitor.
            </h2>
            <p className="text-white/60 text-base max-w-2xl mx-auto">
              Compare us against Snappic, Simple Booth, Touchpix, or Salsa. SnapBooth AI delivers unprecedented beauty, speed, and intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-3xl glass-panel border border-white/10 hover:border-purple-400/50 p-8 transition-all duration-300 hover:-translate-y-1 shadow-xl"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl glass-pill flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-white/10 text-white/80">
                    {feature.badge}
                  </span>
                </div>
                <h3 className="font-bold text-xl text-white mb-2">{feature.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          <div className="rounded-[36px] glass-panel border border-purple-500/30 p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/15 via-indigo-600/15 to-pink-600/15 pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h3 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Ready to Upgrade Your Booth Experience?
              </h3>
              <p className="text-white/70 text-base">
                Set up your first event in less than 2 minutes. Free trial included with full access to AI styles and instant sharing.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-2xl font-black text-base bg-white text-purple-900 hover:bg-white/90 shadow-2xl transition-all active:scale-95"
                >
                  Create Free Event Now →
                </Link>
                <Link
                  href="/booth?event=snapbooth-demo"
                  className="px-8 py-4 rounded-2xl font-bold text-base glass-pill text-white hover:bg-white/15 transition-all"
                >
                  Open Live Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-12">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-white/50 font-medium">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
                S
              </div>
              <span className="font-bold text-white text-sm">SnapBooth AI</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/admin" className="hover:text-white transition">Admin Hub</Link>
              <a href="https://github.com/Kavindraramdeni/photobooth_v2" target="_blank" rel="noreferrer" className="hover:text-white transition">GitHub</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
