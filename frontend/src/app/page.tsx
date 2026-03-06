'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Camera, Zap, QrCode, Sparkles, Share2, BarChart3, ArrowRight, Check } from 'lucide-react';

const features = [
  {
    icon: <Camera className="w-6 h-6" />,
    title: 'Live Photobooth',
    desc: 'Selfie, strip, GIF, boomerang — all modes in one sleek booth experience.',
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'AI Filters & Styles',
    desc: 'HuggingFace-powered generative styles transform photos instantly.',
  },
  {
    icon: <QrCode className="w-6 h-6" />,
    title: 'Instant QR Sharing',
    desc: 'Guests scan and get their photos on their phone in seconds.',
  },
  {
    icon: <Share2 className="w-6 h-6" />,
    title: 'WhatsApp & Instagram',
    desc: 'One-tap sharing to WhatsApp, Instagram Stories, and email.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Live Analytics',
    desc: 'Real-time dashboard showing photos, shares, and engagement.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Event Management',
    desc: 'Create events, set branding, manage galleries — all from admin.',
  },
];

const included = [
  'Unlimited photo modes',
  'AI-powered filters',
  'QR code sharing',
  'WhatsApp & Instagram',
  'Event analytics',
  'Gallery management',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-[#0a0a0f]/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">SnapBooth AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-white/50 hover:text-white text-sm transition-colors">
            Pricing
          </Link>
          <Link
            href="/admin"
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full bg-blue-600/8 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-purple-600/15 border border-purple-500/20 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-purple-300 text-xs font-medium tracking-wide">AI-Powered Photobooth Platform</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            The photobooth
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              your events deserve
            </span>
          </h1>

          <p className="text-white/50 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            AI filters, instant QR sharing, GIFs, boomerangs — everything guests love, 
            managed from one powerful dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/admin"
              className="group flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/booth"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-8 py-4 rounded-xl transition-all text-base"
            >
              <Camera className="w-4 h-4" />
              Try the Booth
            </Link>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/20" />
          <span className="text-white/20 text-xs">scroll</span>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything in one booth</h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            No plugins, no add-ons. Every feature is built in.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto bg-gradient-to-b from-purple-600/15 to-transparent border border-purple-500/20 rounded-3xl p-10 text-center"
        >
          <h2 className="text-3xl font-bold mb-3">Ready to run your first event?</h2>
          <p className="text-white/40 mb-8">Everything included. No setup fees.</p>

          <div className="grid grid-cols-2 gap-2 mb-8 text-left max-w-sm mx-auto">
            {included.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/admin"
              className="group flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              View pricing →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
            <span className="text-white/30 text-sm">SnapBooth AI</span>
          </div>
          <div className="flex items-center gap-6 text-white/25 text-sm">
            <Link href="/pricing" className="hover:text-white/60 transition-colors">Pricing</Link>
            <Link href="/admin" className="hover:text-white/60 transition-colors">Dashboard</Link>
            <Link href="/booth" className="hover:text-white/60 transition-colors">Booth</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
