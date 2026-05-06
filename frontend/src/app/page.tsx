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
} from 'lucide-react';

const features = [
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: 'AI Style Engine',
    desc: 'Transform portraits into cinematic, vintage, watercolor, anime, and brand-themed looks instantly.',
  },
  {
    icon: <QrCode className="w-5 h-5" />,
    title: 'Instant QR Delivery',
    desc: 'Every capture gets a unique QR for immediate downloads, eliminating post-event follow-up.',
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: 'Social Sharing',
    desc: 'Send photos and GIFs to WhatsApp and Instagram-ready formats in one tap.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Live Event Analytics',
    desc: 'Track sessions, popular styles, and conversion performance in real time from your dashboard.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Secure by Design',
    desc: 'Input validation, protected APIs, and role-aware access patterns built for production reliability.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Built for Teams',
    desc: 'Multi-booth operations, branding controls, and scalable architecture for growing event agencies.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#04030a] text-white overflow-x-hidden">
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[860px] rounded-full blur-3xl bg-violet-700/25" />
          <div className="absolute top-[40%] -left-20 h-64 w-64 rounded-full blur-3xl bg-blue-600/20" />
          <div className="absolute top-[30%] -right-16 h-72 w-72 rounded-full blur-3xl bg-fuchsia-600/20" />
        </div>

        <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-[#04030a]/70">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 grid place-items-center font-black">S</div>
              <span className="font-semibold tracking-tight text-lg">SnapBooth AI</span>
            </Link>
            <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition">Features</a>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/admin" className="hover:text-white transition">Dashboard</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-white/70 hover:text-white">Sign in</Link>
              <Link href="/signup" className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 font-semibold">Start free</Link>
            </div>
          </div>
        </nav>

        <section className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 mb-6 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-violet-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Next-gen photobooth SaaS
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight">
              A stunning
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400"> AI photobooth </span>
              your guests never forget.
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-xl leading-relaxed">
              Convert physical moments into viral digital experiences with AI filters, instant QR delivery,
              and real-time event intelligence.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 transition">
                Launch your booth <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/booth?event=snapbooth-demo" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition">
                <Play className="w-4 h-4 fill-current" /> See live demo
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
            <div className="rounded-3xl border border-white/15 bg-white/[0.04] p-6 shadow-2xl shadow-violet-900/30">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-indigo-500/10 to-cyan-500/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/60">Photobooth live preview</p>
                    <h3 className="text-xl font-semibold mt-1">See it in action</h3>
                  </div>
                  <Camera className="w-8 h-8 text-violet-300" />
                </div>
                <div className="mt-6 rounded-2xl overflow-hidden border border-white/15 bg-black/35">
                  <video
                    className="w-full h-52 object-cover"
                    src="https://cdn.coverr.co/videos/coverr-friends-taking-photos-at-a-party-1579/1080p.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black">Everything you need. Nothing you don’t.</h2>
            <p className="text-white/65 mt-3 max-w-2xl mx-auto">Built to impress users, satisfy clients, and scale from side hustles to enterprise-grade event operations.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 hover:bg-white/[0.06] transition">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 border border-violet-300/20 grid place-items-center text-violet-200 mb-4">{feature.icon}</div>
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <p className="text-white/65 mt-2 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-700/20 via-indigo-700/15 to-cyan-700/20 p-8 md:p-12 text-center">
            <h3 className="text-3xl md:text-4xl font-black">Ready to stun every client demo?</h3>
            <p className="text-white/70 mt-3 max-w-2xl mx-auto">Start free, ship fast, and deploy a polished photobooth platform with AI-first differentiation.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/80">
              {['Next.js 16', 'Tailwind CSS', 'AI-ready UX', 'Scalable architecture'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2">
                  <Check className="w-3.5 h-3.5 text-emerald-300" /> {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 mt-14">
          <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="font-semibold">SnapBooth AI</p>
              <p className="text-sm text-white/60 mt-1">Crafted for modern event experiences.</p>
            </div>
            <div className="text-sm text-white/70 space-y-1 md:text-right">
              <p>Built by <a href="https://github.com/Kavindraramdeni" target="_blank" rel="noreferrer" className="underline decoration-white/30 hover:text-white">Kavindra Ramdeni</a></p>
              <div className="flex md:justify-end gap-4">
                <a href="https://github.com/Kavindraramdeni/photobooth_v2" target="_blank" rel="noreferrer" className="hover:text-white">GitHub Repository</a>
                <a href="https://photobooth-v2-ten.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-white">Live Deployment</a>
                <a href="https://www.linkedin.com/in/kavindra-raj" target="_blank" rel="noreferrer" className="hover:text-white">LinkedIn</a>
              </div>
              <p className="text-xs text-white/45">© {new Date().getFullYear()} SnapBooth AI</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
