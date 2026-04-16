'use client';

/**
 * AnalyticsDashboard
 *
 * Drop-in component for the admin event page Analytics tab.
 * Shows: shots over time chart, share rate, peak hour heatmap, mode breakdown.
 *
 * Usage in admin-event-page.tsx:
 *   import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
 *   // In the Analytics tab section:
 *   <AnalyticsDashboard eventId={event.id} />
 *
 * Fetches from:
 *   GET /api/analytics/event/:eventId  (see backend route below)
 */

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HourlyData {
  hour: string;   // "09:00", "10:00" etc
  photos: number;
}

interface DailyData {
  date: string;   // "2026-03-01"
  photos: number;
  gifs: number;
  ai: number;
}

interface ModeData {
  name: string;
  value: number;
  color: string;
}

interface AnalyticsData {
  summary: {
    totalPhotos: number;
    totalGIFs: number;
    totalAI: number;
    totalShares: number;
    totalPrints: number;
    totalEmails: number;
    totalSMS: number;
    shareRate: number;       // shares / photos %
    peakHour: string;        // "14:00"
    avgSessionMin: number;
  };
  daily: DailyData[];
  hourly: HourlyData[];
  modes: ModeData[];
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
      <div className="text-2xl">{emoji}</div>
      <div className="text-2xl font-black text-white" style={color ? { color } : {}}>
        {value}
      </div>
      <div className="text-white/50 text-xs font-medium">{label}</div>
      {sub && <div className="text-white/25 text-[10px]">{sub}</div>}
    </div>
  );
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/20 rounded-xl px-3 py-2 shadow-2xl text-xs">
      <p className="text-white/60 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AnalyticsDashboard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/analytics/event/${eventId}?range=${range}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId, range]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
      <p className="text-red-400 font-semibold">Could not load analytics</p>
      <p className="text-white/40 text-sm mt-1">{error}</p>
    </div>
  );

  if (!data) return null;

  const { summary, daily, hourly, modes } = data;

  return (
    <div className="space-y-6">

      {/* ── Range selector ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Analytics</h3>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['today', '7d', '30d'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
              }`}>
              {r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard emoji="📸" label="Photos" value={summary.totalPhotos} />
        <StatCard emoji="🎬" label="GIFs / Boomerangs" value={summary.totalGIFs} />
        <StatCard emoji="🤖" label="AI Filters" value={summary.totalAI} />
        <StatCard emoji="📤" label="Share Rate" value={`${summary.shareRate}%`}
          sub={`${summary.totalShares} shares`} color="#a855f7" />
        <StatCard emoji="⏰" label="Peak Hour" value={summary.peakHour || '—'}
          sub="most active time" color="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard emoji="🖨️" label="Prints" value={summary.totalPrints} />
        <StatCard emoji="📧" label="Emails Sent" value={summary.totalEmails} />
        <StatCard emoji="💬" label="SMS Sent" value={summary.totalSMS} />
        <StatCard emoji="⏱️" label="Avg Session" value={`${summary.avgSessionMin}m`} />
      </div>

      {/* ── Photos over time ── */}
      {daily.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h4 className="text-white font-semibold text-sm mb-4">📈 Photos Over Time</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gPhotos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGIFs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              <Area type="monotone" dataKey="photos" name="Photos"
                stroke="#7c3aed" fill="url(#gPhotos)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="gifs" name="GIFs"
                stroke="#06b6d4" fill="url(#gGIFs)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="ai" name="AI"
                stroke="#f59e0b" fill="url(#gAI)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Hourly activity + Mode breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Hourly bar chart */}
        {hourly.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h4 className="text-white font-semibold text-sm mb-4">🕐 Activity by Hour</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="photos" name="Photos" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Mode breakdown pie */}
        {modes.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h4 className="text-white font-semibold text-sm mb-4">🎭 Shot Mode Breakdown</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={modes} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {modes.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
                  formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── No data state ── */}
      {daily.length === 0 && hourly.length === 0 && (
        <div className="text-center py-12 text-white/20">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold">No activity yet</p>
          <p className="text-sm mt-1">Data will appear once guests start using the booth</p>
        </div>
      )}
    </div>
  );
}
