'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Zap,
  Play,
  Copy,
  ChevronRight,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

interface LivePrinterMonitorProps {
  eventId: string;
  API_BASE?: string;
}

interface PrinterStatus {
  name: string;
  status: 'ready' | 'printing' | 'paper_low' | 'paper_out';
  paperRemaining: number;
  rollCapacity: number;
  paperPercentage: number;
  silentPrinting: boolean;
  pendingJobs: number;
  completedJobs: number;
  totalJobs: number;
}

interface PrintJob {
  id: string;
  photo_id: string;
  copies: number;
  layout: string;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  printer_id?: string;
  created_at: string;
  photos?: {
    url?: string;
    thumb_url?: string;
    mode?: string;
  };
}

export function LivePrinterMonitor({ eventId, API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001' }: LivePrinterMonitorProps) {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  // 1. Fetch live telemetry & queue
  const fetchData = useCallback(async () => {
    if (!eventId) return;
    try {
      const [statusRes, queueRes] = await Promise.all([
        fetch(`${API_BASE}/api/print/status/${eventId}`),
        fetch(`${API_BASE}/api/print/queue/${eventId}`),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.printer) setStatus(sData.printer);
      }

      if (queueRes.ok) {
        const qData = await queueRes.json();
        setJobs(qData.jobs || []);
      }
    } catch (err) {
      console.warn('[LivePrinterMonitor] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, API_BASE]);

  // Initial fetch and auto-poll
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 2. Real-time Socket.IO subscriptions
  useEffect(() => {
    if (!eventId) return;
    const socket: Socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit('join-event', eventId);
    });

    socket.on('printer-status-updated', (payload: any) => {
      setStatus((prev) => (prev ? { ...prev, ...payload } : payload));
    });

    socket.on('print-job-created', (newJob: PrintJob) => {
      setJobs((prev) => [newJob, ...prev]);
      setStatus((prev) => {
        if (!prev) return null;
        const newRem = Math.max(0, prev.paperRemaining - (newJob.copies || 1));
        return {
          ...prev,
          paperRemaining: newRem,
          paperPercentage: Math.round((newRem / (prev.rollCapacity || 400)) * 100),
          pendingJobs: prev.pendingJobs + 1,
        };
      });
      toast.success(`🖨️ Print job spooled (${newJob.copies || 1}x ${newJob.layout || '4×6'})`, {
        icon: '📄',
        duration: 3000,
      });
    });

    socket.on('print-job-updated', (updatedJob: PrintJob) => {
      setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, API_BASE]);

  // 3. Reset paper roll to 400 prints
  const handleResetRoll = async () => {
    if (!confirm('Reset paper supply to a full 400-print roll?')) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/api/print/reset-roll/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: 400 }),
      });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              paperRemaining: data.paperRemaining,
              rollCapacity: data.rollCapacity,
              paperPercentage: 100,
              status: 'ready',
            }
          : null
      );
      toast.success('🎉 Paper counter reset to 400 prints!');
    } catch (err: any) {
      toast.error(err.message || 'Could not reset paper roll');
    } finally {
      setResetting(false);
    }
  };

  // 4. Reprint job
  const handleReprint = async (jobId: string) => {
    setReprintingId(jobId);
    try {
      const res = await fetch(`${API_BASE}/api/print/reprint/${jobId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Reprint failed');
      toast.success('🖨️ Reprint sent to printer queue!');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not trigger reprint');
    } finally {
      setReprintingId(null);
    }
  };

  // 5. Test Print
  const handleTestPrint = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/print/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          photoId: `test-card-${Date.now()}`,
          copies: 1,
          layout: '4x6',
          silent: true,
        }),
      });
      if (res.ok) {
        toast.success('🖨️ Test 4×6 print job enqueued to DNP driver!');
      }
    } catch {
      toast.error('Failed to trigger test print');
    }
  };

  const paperRem = status?.paperRemaining ?? 400;
  const rollCap = status?.rollCapacity ?? 400;
  const pct = status?.paperPercentage ?? Math.round((paperRem / rollCap) * 100);

  // Status badge colors
  const statusColor =
    status?.status === 'paper_out'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : status?.status === 'paper_low'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : status?.status === 'printing'
      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  const statusLabel =
    status?.status === 'paper_out'
      ? 'Paper Out'
      : status?.status === 'paper_low'
      ? 'Paper Low'
      : status?.status === 'printing'
      ? 'Printing'
      : 'Ready';

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl text-white col-span-full">
      {/* Top Telemetry Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Live Printer Queue &amp; Paper Supply Monitor
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${statusColor}`}>
                ● {statusLabel}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Active Hardware: <strong className="text-zinc-200">{status?.name || 'DNP DS620 Dye-Sub (4×6)'}</strong>
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-sky-400" /> Test 4×6 Print
          </button>
          <button
            onClick={fetchData}
            title="Refresh status"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: Paper Gauge + Silent Print Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-5">
        {/* Paper Supply Gauge Card (7 cols) */}
        <div className="md:col-span-7 bg-zinc-800/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Dye-Sub Paper Roll Supply
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {paperRem} / {rollCap} prints left ({pct}%)
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full bg-zinc-950/80 rounded-full h-4 overflow-hidden border border-white/10 p-0.5 relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pct <= 10
                    ? 'bg-red-500 animate-pulse'
                    : pct <= 25
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.max(3, Math.min(100, pct))}%` }}
              />
            </div>

            {/* Low paper warning alert banner */}
            {pct <= 15 && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>Paper Low Alert:</strong> Only {paperRem} prints remaining. Keep a fresh DNP 4×6 roll ready.
                </span>
              </div>
            )}
          </div>

          {/* Reset Roll Action */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">New dye-sub roll loaded?</span>
            <button
              onClick={handleResetRoll}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              Reset Paper Roll (400 Prints)
            </button>
          </div>
        </div>

        {/* Telemetry Highlights (5 cols) */}
        <div className="md:col-span-5 grid grid-cols-2 gap-3">
          <div className="bg-zinc-800/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Silent Mode</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-black text-white">Zero Dialogs</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1">Direct OS background driver spooling</span>
          </div>

          <div className="bg-zinc-800/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Queue Total</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-black text-white">{jobs.length} Jobs</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1">
              {jobs.filter((j) => j.status === 'completed').length} completed
            </span>
          </div>
        </div>
      </div>

      {/* Live Print Queue Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Live Print Spooler Jobs ({jobs.length})
          </span>
          <span className="text-[11px] text-zinc-500">Auto-updates via Socket.IO</span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center bg-zinc-800/20 rounded-2xl border border-white/5 text-zinc-500 text-xs">
            No prints sent to queue yet. Capturing or printing a 4×6 photo will automatically appear here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-zinc-800/30">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/60 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Photo</th>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Copies / Format</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {jobs.slice(0, 10).map((job) => {
                  const thumb = job.photos?.thumb_url || job.photos?.url;
                  return (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3">
                        {thumb ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumb}
                            alt="Print preview"
                            className="w-9 h-12 object-cover rounded-lg border border-white/10 shadow-sm"
                          />
                        ) : (
                          <div className="w-9 h-12 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                            4×6
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-zinc-400">
                        {job.id.substring(0, 8)}…
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-white">{job.copies || 1}×</span>{' '}
                        <span className="text-zinc-400 uppercase text-[10px]">{job.layout || '4×6'}</span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-zinc-500">
                        {job.created_at ? new Date(job.created_at).toLocaleTimeString() : 'Just now'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : job.status === 'printing'
                              ? 'bg-sky-500/15 text-sky-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          ● {job.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleReprint(job.id)}
                          disabled={reprintingId === job.id}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        >
                          {reprintingId === job.id ? 'Reprinting…' : 'Reprint'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
