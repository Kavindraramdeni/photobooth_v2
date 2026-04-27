'use client';

import { Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export function EventForm({ event, onNameChange, onVenueChange, onDateChange }: any) {
  const boothUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/booth?event=${event.slug}`
    : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            Event Details
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Event Name</label>
            <input type="text" value={event.name}
              onChange={e => onNameChange(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Venue</label>
            <input type="text" value={event.venue || ''}
              onChange={e => onVenueChange(e.target.value)}
              placeholder="Grand Ballroom, Mumbai"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Date</label>
            <input type="date" value={event.date?.split('T')[0] || ''}
              onChange={e => onDateChange(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors block" />
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <h3 className="text-white font-semibold text-sm">Kiosk Access</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Share with your operator</p>
        </div>
        <div className="p-6">
          <p className="text-zinc-500 text-sm mb-4 leading-relaxed">Open in Safari on iPad → Share → Add to Home Screen for fullscreen kiosk mode.</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center gap-2 mb-4">
            <code className="text-violet-300 text-xs truncate flex-1">{boothUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Copied!'); }} className="text-zinc-500 hover:text-white flex-shrink-0">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <Link href={`/booth?event=${event.slug}`} target="_blank"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-violet-500/20">
            <ExternalLink className="w-4 h-4" /> Launch Web Booth
          </Link>
        </div>
      </div>
    </div>
  );
}
