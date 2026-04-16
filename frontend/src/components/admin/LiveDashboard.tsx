'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LivePhoto {
  photoId: string;
  thumbUrl: string;
  galleryUrl: string;
  mode: string;
  timestamp: string;
}

interface LiveStats {
  totalToday:    number;
  thisHour:      number;
  sharesTotal:   number;
  shareRate:     number;
  lastPhotoAt:   string | null;
}

function modeLabel(mode: string) {
  return mode === 'gif'       ? '🎬'
       : mode === 'boomerang' ? '🔄'
       : mode === 'strip'     ? '🎞️'
       : mode === 'ai'        ? '🤖'
       : '📸';
}

function StatBubble({ label, value, sub, pulse }: {
  label: string; value: string | number; sub?: string; pulse?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {pulse && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
        <span className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-white font-black text-2xl">{value}</div>
      {sub && <div className="text-white/25 text-xs">{sub}</div>}
    </div>
  );
}

export function LiveDashboard({ eventId }: { eventId: string }) {
  const [connected,   setConnected]   = useState(false);
  const [livePhotos,  setLivePhotos]  = useState<LivePhoto[]>([]);
  const [stats,       setStats]       = useState<LiveStats>({ totalToday: 0, thisHour: 0, sharesTotal: 0, shareRate: 0, lastPhotoAt: null });
  const [socketError, setSocketError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/analytics/event/${eventId}?range=today`)
      .then(r => r.json())
      .then(data => {
        const s = data.summary || {};
        const total = (s.totalPhotos || 0) + (s.totalGIFs || 0) + (s.totalAI || 0);
        const shares = s.totalShares || 0;
        setStats(prev => ({
          ...prev,
          totalToday: total,
          sharesTotal: shares,
          shareRate: total > 0 ? Math.round((shares / total) * 100) : 0,
        }));
      })
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;

    const trySocket = async () => {
      try {
        const { io } = await import('socket.io-client' as string) as unknown as {
          io: (url: string, opts: object) => {
            on: (event: string, cb: (...args: unknown[]) => void) => void;
            disconnect: () => void;
          }
        };
        const socket = io(API_BASE, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
          setConnected(true);
          setSocketError('');
          (socket as unknown as { emit: (e: string, d: unknown) => void }).emit('join-event', eventId);
        });

        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => {
          setSocketError('Could not connect to live stream');
          setConnected(false);
        });

        socket.on('photo-taken', (...args: unknown[]) => {
          const data = args[0] as LivePhoto;
          setLivePhotos(prev => [data, ...prev].slice(0, 12));
          setStats(prev => {
            const total = prev.totalToday + 1;
            const hour  = prev.thisHour  + 1;
            return {
              ...prev,
              totalToday: total,
              thisHour:   hour,
              shareRate:  total > 0 ? Math.round((prev.sharesTotal / total) * 100) : 0,
              lastPhotoAt: data.timestamp,
            };
          });
        });

        socket.on('photo-shared', () => {
          setStats(prev => ({
            ...prev,
            sharesTotal: prev.sharesTotal + 1,
            shareRate: prev.totalToday > 0
              ? Math.round(((prev.sharesTotal + 1) / prev.totalToday) * 100) : 0,
          }));
        });

        return () => socket.disconnect();
      } catch {
        setSocketError('Live mode unavailable (install socket.io-client for real-time)');
        pollInterval = setInterval(async () => {
          try {
            const r = await fetch(`${API_BASE}/api/analytics/event/${eventId}?range=today`);
            const d = await r.json();
            const s = d.summary || {};
            const total = (s.totalPhotos || 0) + (s.totalGIFs || 0) + (s.totalAI || 0);
            setStats(prev => ({
              ...prev,
              totalToday: total,
              sharesTotal: s.totalShares || 0,
              shareRate: total > 0 ? Math.round(((s.totalShares || 0) / total) * 100) : 0,
            }));
          } catch {}
        }, 15_000);
        return () => clearInterval(pollInterval);
      }
    };

    const cleanup = trySocket();
    return () => { cleanup.then(fn => fn?.()); clearInterval(pollInterval); };
  }, [eventId]);

  const lastPhotoTime = stats.lastPhotoAt
    ? new Date(stats.lastPhotoAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
        <span className="text-white/50 text-sm">
          {connected ? 'Live — updating in real time'
            : socketError ? socketError
            : 'Connecting…'}
        </span>
        {lastPhotoTime && (
          <span className="ml-auto text-white/25 text-xs">Last photo: {lastPhotoTime}</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBubble label="Photos Today"  value={stats.totalToday}  pulse={connected} />
        <StatBubble label="This Hour"     value={stats.thisHour} />
        <StatBubble label="Total Shares"  value={stats.sharesTotal} />
        <StatBubble label="Share Rate"    value={`${stats.shareRate}%`}
          sub={stats.totalToday > 0 ? `${stats.sharesTotal} of ${stats.totalToday}` : 'no photos yet'} />
      </div>

      {livePhotos.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h4 className="text-white font-semibold text-sm">Live Photo Feed</h4>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {livePhotos.slice(0, 12).map((p, i) => (
              <div key={p.photoId || i}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${i === 0 ? 'border-green-400/60 scale-105' : 'border-white/10'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0.5 left-0.5 text-xs leading-none">
                  {modeLabel(p.mode)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {livePhotos.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-3xl mb-3">⏳</p>
          <p className="text-white/40 text-sm">Waiting for first photo…</p>
          <p className="text-white/25 text-xs mt-1">Photos will appear here as guests take them</p>
        </div>
      )}
    </div>
  );
}
