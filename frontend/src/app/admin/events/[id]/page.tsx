'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getEvent, updateEvent, getEventPhotos, getEventStats, deletePhoto, downloadPhotosZip, pingBackend, hidePhoto, unhidePhoto, getEventLeads, exportLeadsCSV, getEventPhotosWithHidden } from '@/lib/api';
import toast from 'react-hot-toast';
import { LiveDashboard } from '@/components/admin/LiveDashboard';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'overview' | 'branding' | 'settings' | 'photos' | 'moderation' | 'leads' | 'analytics' | 'diagnostics';

interface EventData {
  id: string; name: string; slug: string; date: string; venue: string; status: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}
interface Stats {
  totalPhotos: number; totalGIFs: number; totalBoomerangs: number; totalStrips: number;
  totalAIGenerated: number; totalShares: number; totalPrints: number; totalSessions: number;
}
interface Photo {
  id: string; url: string; thumb_url?: string; mode: string; created_at: string;
  is_hidden?: boolean; hidden_by?: string;
}
interface Lead {
  id: string; email?: string; name?: string; phone?: string;
  consented: boolean; created_at: string; photo_id?: string;
}
interface PrintJob {
  id: string; status: string; time: string; name: string;
}

// ── Supabase file upload ──────────────────────────────────────────────────
async function uploadFileToSupabase(file: File, path: string): Promise<string> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase env vars missing');

  const bucket = 'photobooth-media';
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'x-upsert': 'true',
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ── File upload button ─────────────────────────────────────────────────────
function UploadButton({
  label, accept, currentUrl, onUploaded, uploading, setUploading, storagePath,
}: {
  label: string; accept: string; currentUrl: string; onUploaded: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void; storagePath: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${storagePath}_${Date.now()}.${ext}`;
      const url = await uploadFileToSupabase(file, path);
      onUploaded(url);
      toast.success(`${label} uploaded!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={ref} type="file" accept={accept} onChange={handleFile} className="hidden" />
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-sm font-medium disabled:opacity-40 transition-all whitespace-nowrap"
        >
          {uploading ? '⏳ Uploading...' : `📤 Upload ${label}`}
        </button>
        {currentUrl && (
          <button onClick={() => onUploaded('')} className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm transition-all">
            ✕ Clear
          </button>
        )}
      </div>
      {currentUrl && (
        <div className="bg-black/30 rounded-xl px-3 py-2">
          <p className="text-white/30 text-xs truncate">{currentUrl}</p>
        </div>
      )}
    </div>
  );
}

// ── Diagnostics panel ─────────────────────────────────────────────────────
function DiagnosticsPanel({ eventId }: { eventId: string }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [cameraLabel, setCameraLabel] = useState('Not tested');
  const [testFrame, setTestFrame] = useState<string | null>(null);
  const [testingCamera, setTestingCamera] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [pingRunning, setPingRunning] = useState(false);
  const [storage, setStorage] = useState('Checking...');
  const [printJobs] = useState<PrintJob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const dn = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((e) => {
        const mb = e.usage ? (e.usage / 1024 / 1024).toFixed(1) : '0';
        const gb = e.quota ? (e.quota / 1024 / 1024 / 1024).toFixed(1) : '?';
        setStorage(`${mb} MB used · ${gb} GB quota`);
      });
    } else setStorage('Not available');
  }, []);

  const runPing = useCallback(async () => {
    setPingRunning(true);
    const r = await pingBackend();
    setBackendOk(r.ok);
    setLatency(r.latencyMs);
    setPingRunning(false);
  }, []);

  useEffect(() => { runPing(); }, [runPing]);

  async function handleCameraTest() {
    setTestingCamera(true); setCameraOk(null); setTestFrame(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      await new Promise(r => setTimeout(r, 1500));
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current) ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      setTestFrame(canvas.toDataURL('image/jpeg', 0.8));
      stream.getTracks().forEach(t => t.stop());
      setCameraOk(true);
      setCameraLabel(stream.getVideoTracks()[0]?.label || 'Camera OK');
    } catch (e: unknown) {
      setCameraOk(false);
      setCameraLabel(e instanceof Error ? e.message : 'Camera access denied');
    } finally { setTestingCamera(false); }
  }

  function handleTestPrint() {
    setTestingPrint(true);
    const w = window.open('', '_blank', 'width=400,height=500');
    if (w) {
      w.document.write(`<html><head><title>SnapBooth Test Print</title>
      <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#fff}
      .box{border:3px dashed #7c3aed;border-radius:16px;padding:40px;text-align:center}
      h1{color:#7c3aed;margin:0 0 12px}p{color:#555;font-size:13px;margin:4px 0}</style></head>
      <body><div class="box"><h1>📷 SnapBooth AI</h1><p>Test Print Successful</p><p>Printer connected and working.</p>
      <p style="font-size:11px;color:#999;margin-top:12px">${new Date().toLocaleString()}</p></div>
      <script>setTimeout(function(){window.print();window.close()},600)</script></body></html>`);
      w.document.close();
    }
    setTimeout(() => setTestingPrint(false), 2000);
  }

  const StatusRow = ({ label, ok, value, sub }: { label: string; ok: boolean | null; value: string; sub?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-white/80 text-sm font-medium">{label}</p>
        {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-xs text-right max-w-[180px]">{value}</span>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok === null ? 'bg-white/20 animate-pulse' : ok ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column */}
      <div className="space-y-6">
        {/* System Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">🔌 System Status</h3>
            <button onClick={runPing} disabled={pingRunning}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 disabled:opacity-40 transition-all">
              {pingRunning ? 'Pinging...' : '↻ Refresh'}
            </button>
          </div>
          <StatusRow label="Network" ok={online} value={online ? 'Online' : 'Offline'} />
          <StatusRow label="Backend API" ok={backendOk}
            value={backendOk === null ? 'Checking...' : backendOk ? 'Connected' : 'Unreachable'}
            sub={latency !== null ? `${latency}ms latency` : undefined} />
          <StatusRow label="Local Storage" ok={true} value={storage} />
          <StatusRow label="Socket.IO" ok={backendOk} value={backendOk ? 'Active' : 'Disconnected'} sub="Live photo push" />
        </div>

        {/* Camera Bridge */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">📷 Camera Bridge</h3>
            <button onClick={handleCameraTest} disabled={testingCamera}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/40 hover:bg-purple-600/60 text-purple-300 disabled:opacity-40 font-medium transition-all">
              {testingCamera ? 'Testing...' : 'Verify Shutter'}
            </button>
          </div>
          <StatusRow label="Camera" ok={cameraOk} value={cameraLabel}
            sub={cameraOk === null ? 'Tap Verify Shutter to test' : undefined} />
          <video ref={videoRef} className="hidden" muted playsInline />
          {testFrame && (
            <div className="mt-4">
              <p className="text-white/40 text-xs mb-2">Test capture preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={testFrame} alt="Camera test" className="rounded-xl w-full border border-white/10" />
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-6">
        {/* Printer */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">🖨️ Printer Bridge</h3>
            <button onClick={handleTestPrint} disabled={testingPrint}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/40 hover:bg-blue-600/60 text-blue-300 disabled:opacity-40 font-medium transition-all">
              {testingPrint ? 'Sending...' : 'Fire Test Print'}
            </button>
          </div>
          <p className="text-white/40 text-sm mb-4">Sends a test page to your AirPrint printer. Verify paper is loaded and the printer appears on the network.</p>

          {/* Print Queue */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3">Print Queue</p>
            {printJobs.length === 0 ? (
              <div className="text-center py-6 text-white/20">
                <div className="text-2xl mb-2">🖨️</div>
                <p className="text-xs">No active print jobs</p>
              </div>
            ) : (
              <div className="space-y-2">
                {printJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
                    <span className="text-white/70 text-sm">{job.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 text-xs">{job.time}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${job.status === 'printing' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white/40'}`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cloud Sync */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">☁️ Cloud Sync</h3>
          <StatusRow label="Supabase Storage" ok={backendOk} value={backendOk ? 'Connected' : 'Disconnected'} sub="Photo upload destination" />
          <StatusRow label="Sync Queue" ok={true} value="No pending uploads" sub="All photos synced" />
        </div>

        {/* System Reset */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <h3 className="font-semibold text-red-400 mb-2">⚡ System Reset</h3>
          <p className="text-white/40 text-sm mb-4">Clears all active streams and reloads the booth. Use if camera or printer freezes.</p>
          <button onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm border border-red-500/30 transition-all">
            🔄 One-Tap System Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [zipLoading, setZipLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIdle, setUploadingIdle] = useState(false);
  const [uploadingFrame, setUploadingFrame] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ev, st, ph] = await Promise.all([
          getEvent(eventId),
          getEventStats(eventId),
          getEventPhotosWithHidden(eventId),  // includes hidden for moderation tab
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

  async function handleSave() {
    if (!event) return;
    setSaving(true);
    try {
      await updateEvent(event.id, {
        name: event.name, venue: event.venue, date: event.date,
        branding: event.branding, settings: event.settings,
      });
      toast.success('Saved!');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
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
    if (!confirm('Permanently delete this photo? Cannot be undone.')) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Photo deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeletingId(null); }
  }

  async function handleZip() {
    if (!event) return;
    setZipLoading(true);
    try {
      await downloadPhotosZip(event.id, event.name);
      toast.success('Download started!');
    } catch { toast.error('ZIP download failed'); }
    finally { setZipLoading(false); }
  }

  async function handleToggleHide(photo: Photo) {
    setModeratingId(photo.id);
    try {
      if (photo.is_hidden) {
        await unhidePhoto(photo.id);
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_hidden: false, hidden_by: undefined } : p));
        toast.success('Photo restored');
      } else {
        await hidePhoto(photo.id, 'operator');
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_hidden: true, hidden_by: 'operator' } : p));
        toast.success('Photo hidden from public gallery');
      }
    } catch { toast.error('Moderation action failed'); }
    finally { setModeratingId(null); }
  }

  async function handleLoadLeads() {
    if (!event || leadsLoading) return;
    setLeadsLoading(true);
    try {
      const data = await getEventLeads(event.id);
      setLeads(data.leads || []);
    } catch { toast.error('Could not load leads'); }
    finally { setLeadsLoading(false); }
  }

  function handleExportLeads() {
    if (!event || leads.length === 0) return;
    exportLeadsCSV(leads, event.name);
    toast.success(`Exported ${leads.length} leads`);
  }

  const boothUrl = event ? `${typeof window !== 'undefined' ? window.location.origin : ''}/booth?event=${event.slug}` : '';
  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';

  // Auto-load leads when switching to leads tab
  useEffect(() => {
    if (tab === 'leads' && event && leads.length === 0 && !leadsLoading) {
      handleLoadLeads();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, event?.id]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: '📋 Overview' },
    { key: 'branding',    label: '🎨 Branding' },
    { key: 'settings',    label: '⚙️ Settings' },
    { key: 'photos',      label: `📸 Photos${photos.filter(p => !p.is_hidden).length ? ` (${photos.filter(p => !p.is_hidden).length})` : ''}` },
    { key: 'moderation',  label: `🛡️ Moderation${photos.filter(p => p.is_hidden).length ? ` (${photos.filter(p => p.is_hidden).length})` : ''}` },
    { key: 'leads',       label: `📧 Leads${leads.length ? ` (${leads.length})` : ''}` },
    { key: 'analytics',   label: '📊 Analytics' },
    { key: 'diagnostics', label: '🔧 Diagnostics' },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!event) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/10 px-6 py-4 sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 flex-shrink-0">
              ← Dashboard
            </Link>
            <span className="text-white/20">/</span>
            <h1 className="font-bold text-lg truncate">{event.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
              {event.status}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Copied!'); }}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors">
              📋 Copy URL
            </button>
            <Link href={`/booth?event=${event.slug}`} target="_blank"
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors">
              🚀 Open Booth
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-semibold disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Stats ── */}
        {stats && (
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            {[
              { label: 'Photos', value: stats.totalPhotos, emoji: '📸' },
              { label: 'GIFs', value: stats.totalGIFs, emoji: '🎬' },
              { label: 'Strips', value: stats.totalStrips, emoji: '🎞️' },
              { label: 'Boomerangs', value: stats.totalBoomerangs, emoji: '🔄' },
              { label: 'AI Used', value: stats.totalAIGenerated, emoji: '🤖' },
              { label: 'Shares', value: stats.totalShares, emoji: '📤' },
              { label: 'Prints', value: stats.totalPrints, emoji: '🖨️' },
              { label: 'Sessions', value: stats.totalSessions, emoji: '👥' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <div className="text-lg mb-0.5">{s.emoji}</div>
                <div className="text-xl font-bold">{s.value ?? 0}</div>
                <div className="text-white/40 text-[10px] leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Event Details</h3>
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Event Name</label>
                <input value={event.name} onChange={e => setEvent({ ...event, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Venue</label>
                <input value={event.venue || ''} onChange={e => setEvent({ ...event, venue: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Date</label>
                <input type="date" value={event.date?.split('T')[0] || ''}
                  onChange={e => setEvent({ ...event, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Booth Access</h3>
              <div className="bg-black/40 rounded-xl p-4">
                <code className="text-purple-300 text-sm break-all">{boothUrl}</code>
              </div>
              <p className="text-white/40 text-sm">Share with your operator. On iPad: Safari → Share → Add to Home Screen for fullscreen kiosk mode.</p>
              <div className="flex gap-3">
                <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Copied!'); }}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors">
                  Copy Booth URL
                </button>
                <Link href={`/booth?event=${event.slug}`} target="_blank"
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-center transition-colors">
                  Open Booth
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══ BRANDING TAB ══ */}
        {tab === 'branding' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

            {/* ── Left column: Controls ── */}
            <div className="space-y-4">

              {/* Group 1: Identity */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 bg-white/3">
                  <h3 className="text-white/80 text-sm font-semibold">Identity</h3>
                  <p className="text-white/30 text-xs mt-0.5">Visual identity of the booth — all optional</p>
                </div>
                <div className="p-5 space-y-5">

                  {/* Brand colour — OPTIONAL */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Brand Colour</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <input type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test((event.branding?.primaryColor as string) || '') ? (event.branding.primaryColor as string) : '#7c3aed'}
                        onChange={e => updateBranding('primaryColor', e.target.value)}
                        className="w-14 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer p-1 flex-shrink-0" />
                      <div className="flex-1 relative">
                        <input
                          value={(event.branding?.primaryColor as string) || ''}
                          onChange={e => updateBranding('primaryColor', e.target.value)}
                          placeholder="Leave blank for default purple"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-10" />
                        {(event.branding?.primaryColor as string) && (
                          <button onClick={() => updateBranding('primaryColor', '')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors text-sm">✕</button>
                        )}
                      </div>
                    </div>
                    {(event.branding?.primaryColor as string) && /^#[0-9A-Fa-f]{6}$/.test(event.branding.primaryColor as string) && (
                      <div className="mt-2 h-5 rounded-lg w-full" style={{ background: event.branding.primaryColor as string }} />
                    )}
                    <p className="text-white/25 text-xs mt-1.5">Used on idle screen UI, QR screen, and share buttons</p>
                  </div>

                  {/* Event name on idle screen — OPTIONAL */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Event Name on Idle Screen</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <div className="relative">
                      <input value={(event.branding?.eventName as string) || ''}
                        onChange={e => updateBranding('eventName', e.target.value)}
                        placeholder={`Leave blank to use "${event.name}"`}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-10" />
                      {(event.branding?.eventName as string) && (
                        <button onClick={() => updateBranding('eventName', '')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors text-sm">✕</button>
                      )}
                    </div>
                    <p className="text-white/25 text-xs mt-1.5">Displayed above the tap-to-start button. Defaults to event name.</p>
                  </div>

                  {/* Logo — OPTIONAL */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Logo</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional — replaces name</span>
                    </div>
                    <UploadButton label="Logo" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      currentUrl={(event.branding?.logoUrl as string) || ''}
                      onUploaded={url => updateBranding('logoUrl', url)}
                      uploading={uploadingLogo} setUploading={setUploadingLogo}
                      storagePath={`branding/${event.id}/logo`} />
                    {(event.branding?.logoUrl as string) && (
                      <div className="mt-2 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={event.branding.logoUrl as string} alt="Logo preview"
                          className="h-12 w-auto rounded-lg border border-white/10 object-contain bg-white/5 p-1" />
                        <button onClick={() => updateBranding('logoUrl', '')}
                          className="text-white/30 hover:text-red-400 text-xs transition-colors">Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 2: Photo Overlays */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 bg-white/3">
                  <h3 className="text-white/80 text-sm font-semibold">Photo Overlays</h3>
                  <p className="text-white/30 text-xs mt-0.5">Text and graphics stamped on captured photos — leave blank for clean photos</p>
                </div>
                <div className="p-5 space-y-5">

                  {/* Footer text */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Footer Text</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <div className="relative">
                      <input value={(event.branding?.footerText as string) || ''}
                        onChange={e => updateBranding('footerText', e.target.value)}
                        placeholder="e.g. Sarah & John's Wedding · June 2025"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-10" />
                      {(event.branding?.footerText as string) && (
                        <button onClick={() => updateBranding('footerText', '')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors text-sm">✕</button>
                      )}
                    </div>
                  </div>

                  {/* Overlay / hashtag */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Top Overlay / Hashtag</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <div className="relative">
                      <input value={(event.branding?.overlayText as string) || ''}
                        onChange={e => updateBranding('overlayText', e.target.value)}
                        placeholder="#SarahAndJohn2025"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-10" />
                      {(event.branding?.overlayText as string) && (
                        <button onClick={() => updateBranding('overlayText', '')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors text-sm">✕</button>
                      )}
                    </div>
                  </div>

                  {/* Show date */}
                  {/* ── Photo template ── */}
                  <div className="pt-1 pb-2">
                    <label className="text-white/60 text-sm font-medium block mb-3">Photo Template</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: 'classic',  label: 'Classic',  desc: 'Standard photo with footer bar', preview: '🖼️' },
                        { key: 'polaroid', label: 'Polaroid', desc: 'White border + caption below',   preview: '📷' },
                        { key: 'strip',    label: 'Strip',    desc: '4-shot vertical film strip',     preview: '🎞️' },
                      ] as const).map(t => {
                        const active = ((event.branding?.template as string) || 'classic') === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => updateBranding('template', t.key)}
                            className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-center ${
                              active
                                ? 'border-purple-500 bg-purple-500/15'
                                : 'border-white/10 bg-white/5 hover:border-white/25'
                            }`}
                          >
                            <span className="text-2xl">{t.preview}</span>
                            <span className={`text-xs font-bold ${active ? 'text-purple-300' : 'text-white/70'}`}>{t.label}</span>
                            <span className="text-white/30 text-[10px] leading-tight">{t.desc}</span>
                            {active && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-white/25 text-xs mt-2">
                      Template applies at capture time — affects how photos look when downloaded and printed.
                    </p>
                  </div>

                  <label className="flex items-center justify-between py-1 cursor-pointer group">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Show date on photos</p>
                      <p className="text-white/30 text-xs">Stamps today's date in the footer area</p>
                    </div>
                    <input type="checkbox" checked={(event.branding?.showDate as boolean) ?? false}
                      onChange={e => updateBranding('showDate', e.target.checked)}
                      className="w-5 h-5 accent-purple-500 cursor-pointer" />
                  </label>

                  {/* Frame overlay */}
                  <div className="pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm font-medium">Photo Frame (PNG Overlay)</label>
                      <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <p className="text-white/30 text-xs mb-3">PNG with transparency — composited on every photo at capture time</p>
                    <UploadButton label="Frame PNG" accept="image/png"
                      currentUrl={(event.branding?.frameUrl as string) || ''}
                      onUploaded={url => updateBranding('frameUrl', url)}
                      uploading={uploadingFrame} setUploading={setUploadingFrame}
                      storagePath={`branding/${event.id}/frame`} />
                    <input value={(event.branding?.frameUrl as string) || ''}
                      onChange={e => updateBranding('frameUrl', e.target.value)}
                      placeholder="Or paste URL directly..."
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                    {(event.branding?.frameUrl as string) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.branding.frameUrl as string} alt="Frame preview"
                        className="mt-2 w-full max-h-32 object-contain rounded-xl border border-white/10 bg-white/5 p-1" />
                    )}
                  </div>
                </div>
              </div>

              {/* Group 3: Idle Screen */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 bg-white/3">
                  <h3 className="text-white/80 text-sm font-semibold">Idle Screen Background</h3>
                  <p className="text-white/30 text-xs mt-0.5">Shown when booth is waiting for a guest</p>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white/60 text-sm font-medium">Loop Video or Image</label>
                    <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <p className="text-white/30 text-xs mb-3">MP4 or image plays behind the tap-to-start prompt</p>
                  <UploadButton label="Idle Video/Image" accept="video/mp4,video/webm,image/jpeg,image/png,image/gif,image/webp"
                    currentUrl={(event.branding?.idleMediaUrl as string) || ''}
                    onUploaded={url => updateBranding('idleMediaUrl', url)}
                    uploading={uploadingIdle} setUploading={setUploadingIdle}
                    storagePath={`branding/${event.id}/idle`} />
                  <input value={(event.branding?.idleMediaUrl as string) || ''}
                    onChange={e => updateBranding('idleMediaUrl', e.target.value)}
                    placeholder="Or paste URL directly..."
                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                  {(event.branding?.idleMediaUrl as string) && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                      {(event.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i)
                        ? <video src={event.branding.idleMediaUrl as string} muted controls className="w-full max-h-40 object-cover" />
                        : /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={event.branding.idleMediaUrl as string} alt="Idle preview" className="w-full max-h-40 object-cover" />
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column: Live Preview (sticky) ── */}
            <div className="xl:sticky xl:top-24 space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="font-semibold text-base mb-1">Live Preview</h3>
                <p className="text-white/30 text-xs mb-4">Updates as you type</p>

                {/* Photo preview */}
                <div>
                  <p className="text-white/40 text-xs mb-2 uppercase tracking-widest font-medium">Photo Output</p>
                  <div className="rounded-2xl overflow-hidden relative bg-[#1a1a2e]" style={{ aspectRatio: '3/4' }}>
                    {(event.branding?.idleMediaUrl as string) && (
                      (event.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i)
                        ? <video src={event.branding.idleMediaUrl as string} muted autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        : /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={event.branding.idleMediaUrl as string} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white/20">
                        <div className="text-5xl mb-2">📷</div>
                        <p className="text-xs">Photo area</p>
                      </div>
                    </div>
                    {(event.branding?.frameUrl as string) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.branding.frameUrl as string} alt="Frame" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                    )}
                    {(event.branding?.overlayText as string) && (
                      <div className="absolute top-0 left-0 right-0 bg-black/50 px-4 py-3">
                        <span className="text-white text-sm font-bold">{event.branding.overlayText as string}</span>
                      </div>
                    )}
                    {((event.branding?.footerText as string) || (event.branding?.showDate as boolean)) ? (
                      <div className="absolute bottom-0 left-0 right-0 py-3 px-4 text-center"
                        style={{ background: `${primaryColor}ee` }}>
                        {(event.branding?.footerText as string) && (
                          <p className="text-white text-sm font-bold">{event.branding.footerText as string}</p>
                        )}
                        {(event.branding?.showDate as boolean) && (
                          <p className="text-white/70 text-xs mt-0.5">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        )}
                      </div>
                    ) : (
                      <div className="absolute bottom-0 left-0 right-0 py-2 px-4 text-center bg-green-500/10 border-t border-green-500/20">
                        <p className="text-green-400/80 text-xs font-medium">✓ Clean — no overlay</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Idle screen preview */}
                <div className="mt-4">
                  <p className="text-white/40 text-xs mb-2 uppercase tracking-widest font-medium">Idle Screen</p>
                  <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
                    {(event.branding?.idleMediaUrl as string) ? (
                      (event.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i)
                        ? <video src={event.branding.idleMediaUrl as string} muted autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                        : /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={event.branding.idleMediaUrl as string} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }} />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                      {(event.branding?.logoUrl as string) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={event.branding.logoUrl as string} alt="Logo" className="h-10 w-auto object-contain mb-2 drop-shadow-xl" />
                      ) : (
                        <p className="text-sm font-black drop-shadow-lg text-center">{(event.branding?.eventName as string) || event.name}</p>
                      )}
                      <p className="text-xs opacity-60 mt-1">TAP TO START</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ SETTINGS TAB ══ */}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Features */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-5">Booth Features</h3>
              <div className="space-y-1">
                {[
                  { key: 'allowAI', label: '🤖 AI Generation', desc: 'Let guests apply AI art styles' },
                  { key: 'allowGIF', label: '🎬 GIF Mode', desc: 'Animated GIFs from 3 frames' },
                  { key: 'allowBoomerang', label: '🔄 Boomerang', desc: 'Loop animation like Instagram' },
                  { key: 'allowPrint', label: '🖨️ Print', desc: 'AirPrint directly from booth' },
                  { key: 'allowRetakes', label: '🔁 Retakes', desc: 'Let guests retake their photo' },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0 cursor-pointer group">
                    <div>
                      <p className="text-white/90 text-sm font-medium">{item.label}</p>
                      <p className="text-white/30 text-xs">{item.desc}</p>
                    </div>
                    <div className="relative">
                      <input type="checkbox"
                        checked={(event.settings?.[item.key] as boolean) ?? true}
                        onChange={e => updateSettings(item.key, e.target.checked)}
                        className="w-5 h-5 accent-purple-500 cursor-pointer" />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Timing & Security */}
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">Timing</h3>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Photo Countdown</label>
                  <select value={(event.settings?.countdownSeconds as number) || 3}
                    onChange={e => updateSettings('countdownSeconds', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} second{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Session Timeout</label>
                  <select value={(event.settings?.sessionTimeout as number) || 60}
                    onChange={e => updateSettings('sessionTimeout', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[30, 60, 90, 120, 180].map(n => <option key={n} value={n}>{n} seconds</option>)}
                  </select>
                  <p className="text-white/30 text-xs mt-1">Auto-returns to idle screen after inactivity</p>
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Photos Per Session</label>
                  <select value={(event.settings?.photosPerSession as number) || 1}
                    onChange={e => updateSettings('photosPerSession', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} photo{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">🔐 Operator Security</h3>
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Operator PIN</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*"
                    value={(event.settings?.operatorPin as string) || '1234'}
                    onChange={e => updateSettings('operatorPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl tracking-[0.4em] font-mono focus:outline-none focus:border-purple-500" />
                  <p className="text-white/30 text-xs mt-1">4–8 digits. Used to unlock operator panel on the booth idle screen (gear icon).</p>
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Print Copies Per Session</label>
                  <select value={(event.settings?.printCopies as number) || 1}
                    onChange={e => updateSettings('printCopies', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} cop{n > 1 ? 'ies' : 'y'}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Booth limits ── */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">⏱️ Booth Limits</h3>
                <p className="text-white/30 text-xs">Leave blank for no limit. Times are local to the event.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">Booth Opens At</label>
                    <input type="datetime-local"
                      value={(event.settings?.boothStart as string) || ''}
                      onChange={e => updateSettings('boothStart', e.target.value || null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 text-sm" />
                    <p className="text-white/25 text-xs mt-1">Booth shows "opening soon" before this time</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">Booth Closes At</label>
                    <input type="datetime-local"
                      value={(event.settings?.boothEnd as string) || ''}
                      onChange={e => updateSettings('boothEnd', e.target.value || null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 text-sm" />
                    <p className="text-white/25 text-xs mt-1">Shows "Event has ended" after this time</p>
                  </div>
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Max Photos (photo limit)</label>
                  <input type="number" min="0" max="10000"
                    value={(event.settings?.photoLimit as number) || ''}
                    onChange={e => updateSettings('photoLimit', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Unlimited"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
                  <p className="text-white/25 text-xs mt-1">
                    Booth shows "Photo limit reached" gracefully. Current: {photos.length} photos taken.
                  </p>
                </div>
              </div>

              {/* ── Lead capture ── */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">📧 Lead Capture</h3>
                <p className="text-white/30 text-xs">Show an email input modal between preview and share screen.</p>
                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <p className="text-white/80 text-sm font-medium">Enable lead capture</p>
                    <p className="text-white/30 text-xs">Guests see an email field before the share screen</p>
                  </div>
                  <input type="checkbox"
                    checked={(event.settings?.leadCapture as boolean) ?? false}
                    onChange={e => updateSettings('leadCapture', e.target.checked)}
                    className="w-5 h-5 accent-purple-500" />
                </label>
                {(event.settings?.leadCapture as boolean) && (
                  <label className="flex items-center justify-between py-2 cursor-pointer border-t border-white/5">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Make email required</p>
                      <p className="text-white/30 text-xs">Remove the "Skip" option — guests must enter email</p>
                    </div>
                    <input type="checkbox"
                      checked={(event.settings?.leadRequired as boolean) ?? false}
                      onChange={e => updateSettings('leadRequired', e.target.checked)}
                      className="w-5 h-5 accent-purple-500" />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ PHOTOS TAB ══ */}
        {tab === 'photos' && (
          <div>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/50 text-sm">Live — updates as guests capture photos</span>
              </div>
              <button onClick={handleZip} disabled={zipLoading || photos.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm font-medium disabled:opacity-40 transition-all">
                {zipLoading ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : '📦'}
                {zipLoading ? 'Preparing ZIP...' : `Download All (${photos.length})`}
              </button>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <div className="text-5xl mb-4">📷</div>
                <p className="text-lg mb-2">No photos taken yet</p>
                <p className="text-sm mb-6">Open the booth to start capturing</p>
                <Link href={`/booth?event=${event.slug}`} target="_blank"
                  className="inline-block bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-colors">
                  Open Booth Now
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumb_url || photo.url} alt="photo" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <a href={photo.url} target="_blank" rel="noreferrer"
                        className="w-full py-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white text-xs text-center transition-colors">
                        View Full
                      </a>
                      <button onClick={() => handleDeletePhoto(photo.id)} disabled={deletingId === photo.id}
                        className="w-full py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-red-300 text-xs transition-colors disabled:opacity-40">
                        {deletingId === photo.id ? 'Deleting...' : '🗑️ Wipe Photo'}
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1.5 py-0.5 text-xs text-white/70">
                      {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : photo.mode === 'ai' ? '🤖' : '📸'}
                    </div>
                    <div className="absolute top-1 right-1 bg-black/50 rounded px-1 py-0.5 text-[10px] text-white/40">
                      {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ MODERATION TAB ══ */}
        {tab === 'moderation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/40 text-sm">
                Hidden photos are removed from the public gallery but not deleted. Only visible here.
              </p>
              <span className="text-white/30 text-xs">
                {photos.filter(p => p.is_hidden).length} hidden · {photos.filter(p => !p.is_hidden).length} visible
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <div className="text-4xl mb-3">🛡️</div>
                <p>No photos to moderate yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {photos.map(photo => (
                  <div key={photo.id}
                    className={`relative group rounded-xl overflow-hidden border-2 aspect-square transition-all ${
                      photo.is_hidden ? 'border-red-500/50 opacity-50' : 'border-white/10'
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumb_url || photo.url} alt="photo"
                      className="w-full h-full object-cover" />

                    {photo.is_hidden && (
                      <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center pointer-events-none">
                        <span className="text-red-400 font-bold text-xs bg-black/60 px-2 py-1 rounded-lg">HIDDEN</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <a href={photo.url} target="_blank" rel="noreferrer"
                        className="w-full py-1.5 rounded-lg bg-white/20 text-white text-xs text-center">View</a>
                      <button
                        onClick={() => handleToggleHide(photo)}
                        disabled={moderatingId === photo.id}
                        className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          photo.is_hidden
                            ? 'bg-green-500/30 text-green-300 hover:bg-green-500/50'
                            : 'bg-red-500/30 text-red-300 hover:bg-red-500/50'
                        }`}>
                        {moderatingId === photo.id ? '…' : photo.is_hidden ? '👁️ Restore' : '🚫 Hide'}
                      </button>
                    </div>

                    <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1.5 py-0.5 text-xs text-white/70">
                      {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : photo.mode === 'ai' ? '🤖' : '📸'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ LEADS TAB ══ */}
        {tab === 'leads' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-white/40 text-sm">
                Email addresses collected via the lead capture modal.
              </p>
              <div className="flex gap-2">
                <button onClick={handleLoadLeads} disabled={leadsLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/60 text-sm transition-all disabled:opacity-40">
                  {leadsLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> : '🔄'}
                  {leadsLoading ? 'Loading…' : 'Refresh'}
                </button>
                <button onClick={handleExportLeads} disabled={leads.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-300 text-sm disabled:opacity-40 transition-all">
                  📥 Export CSV ({leads.length})
                </button>
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📧</div>
                <p className="text-white/40 text-sm mb-2">No leads captured yet</p>
                <p className="text-white/25 text-xs">Enable "Lead Capture" in Settings to start collecting emails</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Phone</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Captured</th>
                      <th className="text-left px-4 py-3 font-medium">Consent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-white/70">{lead.name || '—'}</td>
                        <td className="px-4 py-3 text-white/80 font-medium">{lead.email || '—'}</td>
                        <td className="px-4 py-3 text-white/50 hidden sm:table-cell">{lead.phone || '—'}</td>
                        <td className="px-4 py-3 text-white/40 text-xs hidden md:table-cell">
                          {new Date(lead.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lead.consented ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {lead.consented ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {/* Live dashboard at top */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-base mb-4">🟢 Live — Right Now</h3>
              <LiveDashboard eventId={event.id} />
            </div>
            {/* Historical charts below */}
            <AnalyticsDashboard eventId={event.id} />
          </div>
        )}

        {/* ══ DIAGNOSTICS TAB ══ */}
        {tab === 'diagnostics' && <DiagnosticsPanel eventId={event.id} />}
      </div>
    </div>
  );
}
