'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io as ioClient, Socket } from 'socket.io-client';
import {
  getEvent, updateEvent, getEventPhotos, getEventStats,
  getEventQR, deletePhoto, downloadPhotosZip,
} from '@/lib/api';
import { DiagnosticsTab } from '@/components/admin/DiagnosticsTab';
import toast from 'react-hot-toast';

type Tab = 'diagnostics' | 'overview' | 'branding' | 'settings' | 'photos';

interface Event {
  id: string; name: string; slug: string; date: string; venue: string; status: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}
interface Stats {
  totalPhotos: number; totalGIFs: number; totalBoomerangs: number; totalStrips: number;
  totalAIGenerated: number; totalShares: number; totalPrints: number; totalSessions: number; totalAll: number;
}
interface Photo {
  id: string; url: string; thumb_url?: string; mode: string; created_at: string; storage_key?: string;
}
interface QRData {
  boothUrl: string; galleryUrl: string; boothQR: string; galleryQR: string;
  event: { name: string };
}

export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Load event data
  useEffect(() => {
    async function load() {
      try {
        const [ev, st, ph] = await Promise.all([
          getEvent(eventId),
          getEventStats(eventId),
          getEventPhotos(eventId),
        ]);
        setEvent(ev);
        setStats(st);
        setPhotos(ph.photos || []);
      } catch {
        toast.error('Event not found');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId, router]);

  // Socket.IO — live photo updates
  useEffect(() => {
    if (!eventId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = ioClient(apiUrl);
    socketRef.current = socket;
    socket.emit('join-event', eventId);

    socket.on('photo-taken', (data: { photoId: string; thumbUrl: string; galleryUrl: string; mode: string; timestamp: string }) => {
      const newPhoto: Photo = {
        id: data.photoId,
        url: data.galleryUrl,
        thumb_url: data.thumbUrl,
        mode: data.mode,
        created_at: data.timestamp,
      };
      setPhotos((prev) => [newPhoto, ...prev]);
      setStats((prev) => prev ? { ...prev, totalAll: (prev.totalAll || 0) + 1, totalPhotos: data.mode === 'single' ? prev.totalPhotos + 1 : prev.totalPhotos } : prev);
      toast.success('New photo captured! 📸', { duration: 2000 });
    });

    socket.on('photo-deleted', ({ photoId }: { photoId: string }) => {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    });

    return () => { socket.disconnect(); };
  }, [eventId]);

  // Load QR when overview tab opened
  useEffect(() => {
    if (tab === 'overview' && !qrData && event) {
      setQrLoading(true);
      getEventQR(event.slug || eventId)
        .then((data) => setQrData(data))
        .catch(() => {})
        .finally(() => setQrLoading(false));
    }
  }, [tab, qrData, event, eventId]);

  async function handleSave() {
    if (!event) return;
    setSaving(true);
    try {
      await updateEvent(event.id, {
        name: event.name,
        venue: event.venue,
        date: event.date,
        branding: event.branding,
        settings: event.settings,
      });
      toast.success('Saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateBranding(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, branding: { ...event.branding, [key]: value } });
  }

  function updateSettings(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, settings: { ...event.settings, [key]: value } });
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Permanently delete this photo? This cannot be undone.')) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success('Photo deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadZip() {
    if (!event) return;
    setZipLoading(true);
    try {
      await downloadPhotosZip(event.id, event.name);
      toast.success('Download started!');
    } catch {
      toast.error('ZIP download failed');
    } finally {
      setZipLoading(false);
    }
  }

  const boothUrl = event ? `${typeof window !== 'undefined' ? window.location.origin : ''}/booth?event=${event.slug}` : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!event) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'diagnostics', label: '🔧 Diagnostics' },
    { key: 'overview', label: '📋 Overview' },
    { key: 'branding', label: '🎨 Branding' },
    { key: 'settings', label: '⚙️ Settings' },
    { key: 'photos', label: `📸 Photos${photos.length ? ` (${photos.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
              ← Dashboard
            </Link>
            <span className="text-white/20">/</span>
            <h1 className="font-bold text-lg">{event.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
              {event.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Booth URL copied!'); }}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors"
            >
              📋 Copy URL
            </button>
            <Link href={`/booth?event=${event.slug}`} target="_blank"
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors">
              🚀 Open Booth
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 font-semibold">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            {[
              { label: 'Photos', value: stats.totalPhotos, emoji: '📸' },
              { label: 'GIFs', value: stats.totalGIFs, emoji: '🎬' },
              { label: 'Strips', value: stats.totalStrips, emoji: '🎞️' },
              { label: 'Boomerang', value: stats.totalBoomerangs, emoji: '🔄' },
              { label: 'AI Used', value: stats.totalAIGenerated, emoji: '🤖' },
              { label: 'Shares', value: stats.totalShares, emoji: '📤' },
              { label: 'Prints', value: stats.totalPrints, emoji: '🖨️' },
              { label: 'Sessions', value: stats.totalSessions, emoji: '👥' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                <div className="text-base mb-0.5">{s.emoji}</div>
                <div className="text-lg font-bold">{s.value ?? 0}</div>
                <div className="text-white/40 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DIAGNOSTICS TAB ── */}
        {tab === 'diagnostics' && <DiagnosticsTab eventId={event.id} />}

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Event details */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Event Details</h3>
              <div>
                <label className="text-white/50 text-sm block mb-1">Event Name</label>
                <input value={event.name} onChange={(e) => setEvent({ ...event, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Venue</label>
                <input value={event.venue || ''} onChange={(e) => setEvent({ ...event, venue: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Date</label>
                <input type="date" value={event.date?.split('T')[0] || ''}
                  onChange={(e) => setEvent({ ...event, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
            </div>

            {/* Booth URL + QR */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Booth Access</h3>
              <div className="bg-black/40 rounded-xl p-3">
                <code className="text-purple-300 text-xs break-all">{boothUrl}</code>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Copied!'); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors">
                  Copy URL
                </button>
                <Link href={`/booth?event=${event.slug}`} target="_blank"
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors text-center">
                  Open Booth
                </Link>
              </div>

              {/* QR Codes */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-white/50 text-sm mb-3">QR Codes — print and display at your event</p>
                {qrLoading ? (
                  <div className="flex gap-4">
                    {[0, 1].map((i) => (
                      <div key={i} className="w-32 h-32 bg-white/10 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : qrData ? (
                  <div className="flex gap-6 flex-wrap">
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrData.boothQR} alt="Booth QR" className="w-32 h-32 rounded-xl border border-white/10" />
                      <p className="text-white/40 text-xs mt-1">📷 Booth</p>
                      <a href={qrData.boothQR} download="booth-qr.png"
                        className="text-purple-400 text-xs hover:text-purple-300 transition-colors">Download</a>
                    </div>
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrData.galleryQR} alt="Gallery QR" className="w-32 h-32 rounded-xl border border-white/10" />
                      <p className="text-white/40 text-xs mt-1">🖼️ Gallery</p>
                      <a href={qrData.galleryQR} download="gallery-qr.png"
                        className="text-purple-400 text-xs hover:text-purple-300 transition-colors">Download</a>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/30 text-sm">Could not load QR codes</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BRANDING TAB ── */}
        {tab === 'branding' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">🎨 Branding Settings</h3>

              <div>
                <label className="text-white/50 text-sm block mb-1">Event Header Name</label>
                <input value={(event.branding?.eventName as string) || event.name}
                  onChange={(e) => updateBranding('eventName', e.target.value)}
                  placeholder="Displayed on booth idle screen"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">Brand Color</label>
                <div className="flex gap-3">
                  <input type="color" value={(event.branding?.primaryColor as string) || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer" />
                  <input value={(event.branding?.primaryColor as string) || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500" />
                </div>
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">Footer Text (printed on photos)</label>
                <input value={(event.branding?.footerText as string) || ''}
                  onChange={(e) => updateBranding('footerText', e.target.value)}
                  placeholder="e.g. Sarah & John's Wedding · June 2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">Overlay Text (top of photo)</label>
                <input value={(event.branding?.overlayText as string) || ''}
                  onChange={(e) => updateBranding('overlayText', e.target.value)}
                  placeholder="e.g. #SarahAndJohn2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">Logo URL</label>
                <input value={(event.branding?.logoUrl as string) || ''}
                  onChange={(e) => updateBranding('logoUrl', e.target.value)}
                  placeholder="https://... (PNG recommended)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">
                  🎬 Booth Loop — Idle Screen Media URL
                </label>
                <input value={(event.branding?.idleMediaUrl as string) || ''}
                  onChange={(e) => updateBranding('idleMediaUrl', e.target.value)}
                  placeholder="https://... (MP4 video or image URL)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
                <p className="text-white/30 text-xs mt-1">Upload a video or image to Supabase Storage and paste the public URL here. Plays on loop when booth is idle.</p>
              </div>

              <div>
                <label className="text-white/50 text-sm block mb-1">
                  🖼️ Photo Frame Overlay URL
                </label>
                <input value={(event.branding?.frameUrl as string) || ''}
                  onChange={(e) => updateBranding('frameUrl', e.target.value)}
                  placeholder="https://... (PNG with transparency)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
                <p className="text-white/30 text-xs mt-1">PNG frame composited onto every photo at capture time.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={(event.branding?.showDate as boolean) ?? true}
                  onChange={(e) => updateBranding('showDate', e.target.checked)}
                  className="w-4 h-4 accent-purple-500" />
                <span className="text-white/70 text-sm">Show date on photos</span>
              </label>
            </div>

            {/* Live preview */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
              <div className="rounded-xl overflow-hidden relative"
                style={{ background: (event.branding?.primaryColor as string) || '#7c3aed', aspectRatio: '4/3' }}>
                <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
                  Photo Preview Area
                </div>
                {(event.branding?.overlayText as string) && (
                  <div className="absolute top-0 left-0 right-0 bg-black/40 px-4 py-2">
                    <span className="text-white text-sm font-bold">{event.branding.overlayText as string}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 py-3 px-4 text-center"
                  style={{ background: `${(event.branding?.primaryColor as string) || '#7c3aed'}dd` }}>
                  <span className="text-white text-sm font-bold">
                    {(event.branding?.footerText as string) || event.name}
                  </span>
                </div>
              </div>
              {(event.branding?.idleMediaUrl as string) && (
                <div className="mt-4">
                  <p className="text-white/50 text-xs mb-2">Idle media preview:</p>
                  {(event.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={event.branding.idleMediaUrl as string} controls muted
                      className="rounded-xl w-full max-h-40 object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.branding.idleMediaUrl as string} alt="Idle media"
                      className="rounded-xl w-full max-h-40 object-cover" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-6">Booth Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-white/60 text-sm font-medium uppercase tracking-wider">Features</h4>
                {[
                  { key: 'allowAI', label: '🤖 AI Generation' },
                  { key: 'allowGIF', label: '🎬 GIF Mode' },
                  { key: 'allowBoomerang', label: '🔄 Boomerang' },
                  { key: 'allowPrint', label: '🖨️ Print' },
                  { key: 'allowRetakes', label: '🔁 Retakes' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 cursor-pointer">
                    <span className="text-white/80">{item.label}</span>
                    <input type="checkbox"
                      checked={(event.settings?.[item.key] as boolean) ?? true}
                      onChange={(e) => updateSettings(item.key, e.target.checked)}
                      className="w-5 h-5 accent-purple-500" />
                  </label>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-white/60 text-sm font-medium uppercase tracking-wider">Timing & Security</h4>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Countdown (seconds)</label>
                  <select value={(event.settings?.countdownSeconds as number) || 3}
                    onChange={(e) => updateSettings('countdownSeconds', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Session Timeout (seconds)</label>
                  <select value={(event.settings?.sessionTimeout as number) || 60}
                    onChange={(e) => updateSettings('sessionTimeout', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[30, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Photos Per Session</label>
                  <select value={(event.settings?.photosPerSession as number) || 1}
                    onChange={(e) => updateSettings('photosPerSession', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Operator PIN</label>
                  <input type="password"
                    value={(event.settings?.operatorPin as string) || '1234'}
                    onChange={(e) => updateSettings('operatorPin', e.target.value)}
                    maxLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                  <p className="text-white/30 text-xs mt-1">Used to access operator panel on booth idle screen</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {tab === 'photos' && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/60 text-sm">Live — updates as guests take photos</span>
              </div>
              <button onClick={handleDownloadZip} disabled={zipLoading || photos.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm font-medium transition-all disabled:opacity-40">
                {zipLoading ? (
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : '📦'}
                {zipLoading ? 'Preparing ZIP...' : `Download All (${photos.length})`}
              </button>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <div className="text-5xl mb-4">📷</div>
                <p>No photos yet. Open the booth to start capturing!</p>
                <Link href={`/booth?event=${event.slug}`} target="_blank"
                  className="inline-block mt-4 bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-sm font-semibold transition-colors text-white">
                  Open Booth Now
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id}
                    className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumb_url || photo.url} alt="Photo"
                      className="w-full h-full object-cover" />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <a href={photo.url} target="_blank" rel="noreferrer"
                        className="w-full py-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white text-xs text-center transition-colors">
                        View
                      </a>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletingId === photo.id}
                        className="w-full py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-red-300 text-xs transition-colors disabled:opacity-40">
                        {deletingId === photo.id ? 'Deleting...' : '🗑️ Wipe'}
                      </button>
                    </div>

                    {/* Mode badge */}
                    <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-xs text-white/70">
                      {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : photo.mode === 'ai' ? '🤖' : '📸'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
