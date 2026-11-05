import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  branding: Record<string, unknown>;
}

interface Stats {
  totalPhotos: number;
  totalSessions: number;
  totalShares: number;
  totalPrints: number;
}

interface LiveOperationsHubProps {
  event: Event;
  stats: Stats | null;
  API_BASE: string;
}

type ApiStatus = 'idle' | 'checking' | 'ok' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function copyToClipboard(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copied!`))
    .catch(() => toast.error('Clipboard write failed'));
}

function StatusBadge({ status }: { status: string }) {
  const normalised = status?.toLowerCase();
  const configs: Record<string, { dot: string; text: string; label: string }> = {
    active:   { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Active'   },
    paused:   { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Paused'   },
    archived: { dot: 'bg-red-500',     text: 'text-red-400',     label: 'Archived' },
  };
  const cfg = configs[normalised] ?? { dot: 'bg-zinc-500', text: 'text-zinc-400', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      {cfg.label}
    </span>
  );
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04]
                  rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
      {children}
    </h3>
  );
}

// ─── 1. Launch Hero Card ──────────────────────────────────────────────────────

function LaunchHeroCard({ event }: { event: Event }) {
  const boothUrl     = `/booth?event=${event.slug}`;
  const slideshowUrl = `/slideshow/${event.id}`;
  const galleryUrl   = `/gallery/${event.slug}`;

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <Card className="bg-gradient-to-br from-violet-950/60 via-zinc-900/40 to-zinc-900/40
                     border-violet-500/20 col-span-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white">{event.name}</h2>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-zinc-500">slug: <code className="text-zinc-400">{event.slug}</code></p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Primary – Launch Booth */}
        <button
          onClick={() => open(boothUrl)}
          className="flex items-center justify-center gap-2 px-5 py-3.5
                     bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                     text-white font-semibold text-sm rounded-xl
                     shadow-lg shadow-violet-900/50
                     transition-all duration-150 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-violet-400 col-span-1 sm:col-span-1"
        >
          <span className="text-lg" aria-hidden="true">🚀</span>
          Launch Booth
        </button>

        <button
          onClick={() => open(slideshowUrl)}
          className="flex items-center justify-center gap-2 px-5 py-3.5
                     bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.04]
                     text-zinc-200 font-medium text-sm rounded-xl border border-white/[0.08]
                     transition-all duration-150 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span className="text-lg" aria-hidden="true">📺</span>
          Live Slideshow
        </button>

        <button
          onClick={() => open(galleryUrl)}
          className="flex items-center justify-center gap-2 px-5 py-3.5
                     bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.04]
                     text-zinc-200 font-medium text-sm rounded-xl border border-white/[0.08]
                     transition-all duration-150 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span className="text-lg" aria-hidden="true">🖼️</span>
          Guest Gallery
        </button>
      </div>
    </Card>
  );
}

// ─── 2. Operator PIN Card ─────────────────────────────────────────────────────

function OperatorPinCard({ event }: { event: Event }) {
  const [pinVisible, setPinVisible] = useState(false);
  const pin = String(event.settings.operatorPin ?? '—');
  const setupLink = `/booth?event=${event.slug}&pin=${pin}`;

  return (
    <Card>
      <CardTitle>Operator PIN</CardTitle>

      <div className="flex items-center gap-3 mb-4">
        {/* PIN display */}
        <div
          className="flex-1 flex items-center justify-between
                     bg-zinc-800/60 border border-white/[0.06] rounded-xl px-4 py-3"
        >
          <span className={`font-mono text-lg tracking-widest ${pinVisible ? 'text-white' : 'text-zinc-600'}`}>
            {pinVisible ? pin : '• • • • • •'}
          </span>
          <button
            onClick={() => setPinVisible((v) => !v)}
            aria-label={pinVisible ? 'Hide PIN' : 'Show PIN'}
            className="text-zinc-500 hover:text-zinc-200 transition-colors ml-2
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
          >
            {pinVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Copy PIN */}
        <button
          onClick={() => copyToClipboard(pin, 'PIN')}
          aria-label="Copy PIN"
          className="p-3 bg-zinc-800/60 border border-white/[0.06] rounded-xl
                     text-zinc-400 hover:text-white transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Copy size={16} />
        </button>
      </div>

      {/* Copy setup link */}
      <button
        onClick={() => copyToClipboard(setupLink, 'Booth setup link')}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                   bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                   text-zinc-300 text-sm font-medium rounded-xl transition-all
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <Copy size={14} />
        Copy Booth Setup Link
      </button>

      <p className="mt-3 text-xs text-zinc-600 leading-relaxed">
        Share this PIN with on-site staff to let them launch the kiosk.
      </p>
    </Card>
  );
}

// ─── 3. Live Stats Card ───────────────────────────────────────────────────────

function LiveStatsCard({ stats }: { stats: Stats | null }) {
  const items = [
    { emoji: '📸', label: 'Photos',   value: stats?.totalPhotos   },
    { emoji: '👥', label: 'Sessions', value: stats?.totalSessions },
    { emoji: '📤', label: 'Shares',   value: stats?.totalShares   },
    { emoji: '🖨️', label: 'Prints',   value: stats?.totalPrints   },
  ];

  return (
    <Card>
      <CardTitle>Live Stats</CardTitle>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ emoji, label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center
                       bg-zinc-800/40 rounded-xl py-4 gap-1"
          >
            <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
            <span className="text-xl font-bold text-white mt-1">
              {value === undefined ? (
                <span className="text-zinc-600">—</span>
              ) : (
                value.toLocaleString()
              )}
            </span>
            <span className="text-xs text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── 4. System Diagnostics Card ───────────────────────────────────────────────

function SystemDiagnosticsCard({ API_BASE }: { API_BASE: string }) {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');

  const checkApi = useCallback(async () => {
    setApiStatus('checking');
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
      setApiStatus(res.ok ? 'ok' : 'error');
    } catch {
      setApiStatus('error');
    }
  }, [API_BASE]);

  // Auto-check on mount
  useEffect(() => { checkApi(); }, [checkApi]);

  const handleTestPrint = () => {
    window.print();
    toast('Print dialog opened', { icon: '🖨️' });
  };

  const statusUi: Record<ApiStatus, { icon: React.ReactNode; label: string; colour: string }> = {
    idle:     { icon: <Wifi size={14} />,         label: 'Not checked',  colour: 'text-zinc-500' },
    checking: { icon: <Loader2 size={14} className="animate-spin" />, label: 'Checking…', colour: 'text-zinc-400' },
    ok:       { icon: <CheckCircle2 size={14} />, label: 'Online',       colour: 'text-emerald-400' },
    error:    { icon: <XCircle size={14} />,      label: 'Unreachable',  colour: 'text-red-400' },
  };

  const { icon, label, colour } = statusUi[apiStatus];

  return (
    <Card>
      <CardTitle>System Diagnostics</CardTitle>

      {/* API Status row */}
      <div className="flex items-center justify-between
                      bg-zinc-800/40 rounded-xl px-4 py-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Backend API</span>
          <span className={`flex items-center gap-1 font-medium ${colour}`}>
            {icon}
            {label}
          </span>
        </div>

        <button
          onClick={checkApi}
          disabled={apiStatus === 'checking'}
          aria-label="Refresh API status"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white
                     disabled:opacity-40 transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <RefreshCw size={14} className={apiStatus === 'checking' ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Test print */}
      <button
        onClick={handleTestPrint}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                   bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                   text-zinc-300 text-sm font-medium rounded-xl transition-all
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <Printer size={14} />
        Test Print
      </button>
    </Card>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

const LiveOperationsHub: React.FC<LiveOperationsHubProps> = ({ event, stats, API_BASE }) => {
  return (
    <section aria-label="Live Operations Hub" className="p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full-width hero */}
        <LaunchHeroCard event={event} />

        {/* Operator PIN */}
        <OperatorPinCard event={event} />

        {/* Live Stats */}
        <LiveStatsCard stats={stats} />

        {/* System Diagnostics */}
        <SystemDiagnosticsCard API_BASE={API_BASE} />
      </div>
    </section>
  );
};

export default LiveOperationsHub;
