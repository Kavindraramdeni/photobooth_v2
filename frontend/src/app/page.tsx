import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 text-center mb-12">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-900/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
        <h1 className="text-5xl font-black tracking-tight mb-3">SnapBooth AI</h1>
        <p className="text-white/50 text-xl max-w-md mx-auto">
          Professional AI-powered photobooth platform for unforgettable events
        </p>
      </div>

      {/* Main CTAs */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-4 mb-16">
        <Link
          href="/admin"
          className="flex items-center gap-3 bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-900/40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Operator Dashboard
        </Link>
        <Link
          href="/booth?event=demo"
          className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
          Try Demo Booth
        </Link>
      </div>

      {/* Features grid */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full">
        {[
          { emoji: '🤖', title: 'AI Generation', desc: '6 artistic styles' },
          { emoji: '🎬', title: 'GIF & Boomerang', desc: 'Animated memories' },
          { emoji: '📱', title: 'Instant QR Share', desc: 'Guests get photos fast' },
          { emoji: '🎨', title: 'Custom Branding', desc: 'Per-event overlays' },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-2">{f.emoji}</div>
            <div className="font-semibold text-sm">{f.title}</div>
            <div className="text-white/40 text-xs mt-1">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* How to launch */}
      <div className="relative z-10 mt-12 bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md w-full text-center">
        <p className="text-white/60 text-sm mb-3 font-medium">Launch a booth for your event:</p>
        <code className="text-purple-300 text-sm bg-black/40 px-4 py-2 rounded-lg block">
          /booth?event=your-event-slug
        </code>
        <p className="text-white/30 text-xs mt-3">
          Create events in the <Link href="/admin" className="text-purple-400 underline">Admin Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
