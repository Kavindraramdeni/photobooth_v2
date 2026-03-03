'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import { getEventPhotos, getEventStats, deletePhoto, downloadPhotosZip, updateEvent, pingBackend } from '@/lib/api';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'branding' | 'settings' | 'photos' | 'diagnostics';

interface Photo { id: string; url: string; thumb_url?: string; mode: string; created_at: string; }
interface Stats {
  totalPhotos: number; totalGIFs: number; totalBoomerangs: number; totalStrips: number;
  totalAIGenerated: number; totalShares: number; totalPrints: number; totalSessions: number;
}

// ── File upload helper (uses Supabase Storage public URL) ─────────────────
async function uploadToSupabase(file: File, path: string): Promise<string> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase not configured — check env vars');
  const bucket = 'photobooth-media';

  // Use PUT with upsert — more reliable than POST for branding assets
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'x-upsert': 'true',
      'Content-Type': file.type,
      'Cache-Control': '3600',
    },
    body: file,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { detail = res.statusText; }
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ── Compact upload field for operator panel ────────────────────────────────
function OperatorUpload({ label, accept, currentUrl, onUploaded, storagePath }: {
  label: string; accept: string; currentUrl: string;
  onUploaded: (url: string) => void; storagePath: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const url = await uploadToSupabase(file, `${storagePath}_${Date.now()}.${ext}`);
      onUploaded(url);
      toast.success(`${label} uploaded!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <input ref={ref} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <button onClick={() => ref.current?.click()} disabled={uploading}
        className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 disabled:opacity-40 font-medium transition-all">
        {uploading ? '⏳...' : '📤 Upload'}
      </button>
      {currentUrl && (
        <button onClick={() => onUploaded('')} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400">
          ✕
        </button>
      )}
    </div>
  );
}

// ── PIN Entry ─────────────────────────────────────────────────────────────
// KEY FIX: auto-check uses `next` (local var) not `pin` (stale state closure).
// This prevents the wrong-PIN false-positive when user types all digits fast.
function PinEntry({ correctPin, onSuccess, onCancel }: {
  correctPin: string; onSuccess: () => void; onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');

  function doCheck(p: string) {
    if (p === correctPin) {
      onSuccess();
    } else {
      setShake(true);
      setError('Wrong PIN — try again');
      setTimeout(() => { setPin(''); setShake(false); setError(''); }, 800);
    }
  }

  function pressDigit(d: string) {
    if (shake) return; // ignore taps during error shake
    if (pin.length >= 8) return;
    const next = pin + d;
    setPin(next);
    setError('');
    // Auto-submit: use `next` directly — avoids stale closure on `pin`
    if (next.length === correctPin.length && next.length >= 4) {
      setTimeout(() => doCheck(next), 120);
    }
  }

  function pressBack() {
    if (shake) return;
    setPin(p => p.slice(0, -1));
    setError('');
  }

  function pressConfirm() {
    if (pin.length === 0 || shake) return;
    doCheck(pin);
  }

  const maxLen = Math.max(correctPin.length, 4);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-[#0a0a0f]">
      <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center mb-6">
        <Settings className="w-8 h-8 text-purple-400" />
      </div>
      <h2 className="text-white text-2xl font-bold mb-1">Operator Access</h2>
      <p className="text-white/40 text-sm mb-8">Enter operator PIN to continue</p>

      {/* PIN dots */}
      <motion.div
        animate={shake ? { x: [-12, 12, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-3"
      >
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < pin.length
              ? shake ? 'bg-red-500 border-red-400' : 'bg-purple-500 border-purple-400 scale-110'
              : 'bg-transparent border-white/30'
          }`} />
        ))}
      </motion.div>
      {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
      {!error && <div className="mb-4 h-4" />}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-64 mb-4">
        {['1','2','3','4','5','6','7','8','9'].map(key => (
          <button key={key}
            onPointerDown={e => { e.stopPropagation(); pressDigit(key); }}
            className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 text-white text-xl font-semibold transition-all select-none">
            {key}
          </button>
        ))}
        <div />
        <button
          onPointerDown={e => { e.stopPropagation(); pressDigit('0'); }}
          className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 text-white text-xl font-semibold transition-all select-none">
          0
        </button>
        <button
          onPointerDown={e => { e.stopPropagation(); pressBack(); }}
          className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/60 text-xl transition-all select-none">
          ⌫
        </button>
      </div>

      {/* Unlock button shown when PIN is shorter than expected length */}
      {pin.length > 0 && pin.length < correctPin.length && (
        <button onPointerDown={e => { e.stopPropagation(); pressConfirm(); }}
          className="w-64 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all mb-3 select-none">
          Unlock →
        </button>
      )}

      <button
        onPointerDown={e => { e.stopPropagation(); onCancel(); }}
        className="text-white/30 hover:text-white/60 text-sm transition-colors mt-2 select-none">
        Cancel
      </button>
    </div>
  );
}

// ── Diagnostics (compact for operator panel) ──────────────────────────────
function DiagnosticsPanel() {
  const [online, setOnline] = useState(navigator.onLine);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [cameraLabel, setCameraLabel] = useState('Not tested');
  const [testFrame, setTestFrame] = useState<string | null>(null);
  const [testingCamera, setTestingCamera] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const dn = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  const runPing = useCallback(async () => {
    const r = await pingBackend();
    setBackendOk(r.ok);
    setLatency(r.latencyMs);
  }, []);
  useEffect(() => { runPing(); }, [runPing]);

  async function testCamera() {
    setTestingCamera(true); setCameraOk(null); setTestFrame(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      await new Promise(r => setTimeout(r, 1500));
      const canvas = document.createElement('canvas');
      canvas.width = 280; canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current) ctx.drawImage(videoRef.current, 0, 0, 280, 200);
      setTestFrame(canvas.toDataURL('image/jpeg', 0.8));
      stream.getTracks().forEach(t => t.stop());
      setCameraOk(true);
      setCameraLabel(stream.getVideoTracks()[0]?.label || 'Camera OK');
    } catch (e: unknown) {
      setCameraOk(false);
      setCameraLabel(e instanceof Error ? e.message : 'Camera denied');
    } finally { setTestingCamera(false); }
  }

  function testPrint() {
    setTestingPrint(true);
    const w = window.open('', '_blank', 'width=400,height=500');
    if (w) {
      w.document.write(`<html><head><title>Test Print</title>
        <style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial}
        .box{border:3px dashed #7c3aed;border-radius:16px;padding:40px;text-align:center}h1{color:#7c3aed}</style></head>
        <body><div class="box"><h1>📷 SnapBooth AI</h1><p>Test Print OK</p><p style="font-size:12px;color:#999">${new Date().toLocaleString()}</p></div>
        <script>setTimeout(function(){window.print();window.close()},500)</script></body></html>`);
      w.document.close();
    }
    setTimeout(() => setTestingPrint(false), 2000);
  }

  const Row = ({ label, ok, value }: { label: string; ok: boolean | null; value: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <p className="text-white/70 text-sm">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs">{value}</span>
        <div className={`w-2 h-2 rounded-full ${ok === null ? 'bg-white/20 animate-pulse' : ok ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-semibold text-sm">🔌 System</h4>
          <button onClick={runPing} className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/50">↻</button>
        </div>
        <Row label="Network" ok={online} value={online ? 'Online' : 'Offline'} />
        <Row label="Backend" ok={backendOk} value={backendOk === null ? 'Checking...' : backendOk ? `${latency}ms` : 'Unreachable'} />
      </div>

      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-semibold text-sm">📷 Camera</h4>
          <button onClick={testCamera} disabled={testingCamera}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-600/30 text-purple-300 disabled:opacity-40">
            {testingCamera ? '...' : 'Verify Shutter'}
          </button>
        </div>
        <Row label="Status" ok={cameraOk} value={cameraLabel} />
        <video ref={videoRef} className="hidden" muted playsInline />
        {testFrame && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={testFrame} alt="test" className="rounded-xl w-full border border-white/10" />
          </div>
        )}
      </div>

      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white font-semibold text-sm">🖨️ Printer</h4>
          <button onClick={testPrint} disabled={testingPrint}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600/30 text-blue-300 disabled:opacity-40">
            {testingPrint ? 'Sending...' : 'Fire Test Print'}
          </button>
        </div>
        <p className="text-white/30 text-xs mb-3">Sends test page to AirPrint printer</p>
        <div className="text-center py-4 text-white/20 text-xs border border-white/5 rounded-xl">No active print jobs</div>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
        <h4 className="text-red-400 font-semibold text-sm mb-2">⚡ System Reset</h4>
        <p className="text-white/30 text-xs mb-3">Reloads booth if camera or printer freezes</p>
        <button onClick={() => window.location.reload()}
          className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm border border-red-500/20 transition-all">
          🔄 One-Tap Reset
        </button>
      </div>
    </div>
  );
}

// ── Main Operator Panel ───────────────────────────────────────────────────
function OperatorPanel({ onClose }: { onClose: () => void }) {
  const { event: storeEvent, setEvent } = useBoothStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localEvent, setLocalEvent] = useState(() => {
    if (!storeEvent) return null;
    const e = JSON.parse(JSON.stringify(storeEvent));
    // Guarantee branding defaults so color picker always gets a valid hex
    e.branding = {
      primaryColor: '#7c3aed',
      secondaryColor: '#4f46e5',
      eventName: '',
      footerText: '',
      overlayText: '',
      showDate: true,
      template: 'classic',
      logoUrl: null,
      idleMediaUrl: null,
      frameUrl: null,
      ...(e.branding || {}),
    };
    if (!e.branding.primaryColor || !e.branding.primaryColor.startsWith('#')) {
      e.branding.primaryColor = '#7c3aed';
    }
    e.settings = {
      countdownSeconds: 3,
      photosPerSession: 1,
      allowRetakes: true,
      allowAI: false,
      allowGIF: true,
      allowBoomerang: true,
      allowPrint: true,
      printCopies: 1,
      aiStyles: [],
      sessionTimeout: 60,
      operatorPin: '1234',
      ...(e.settings || {}),
    };
    return e;
  });

  const eventId = storeEvent?.id || '';

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    Promise.all([
      getEventPhotos(eventId).then(d => setPhotos(d.photos || [])),
      getEventStats(eventId).then(s => setStats(s)),
    ]).finally(() => setLoading(false));
  }, [eventId]);

  async function handleSave() {
    if (!localEvent || !eventId) return;
    setSaving(true);
    try {
      await updateEvent(eventId, {
        name: localEvent.name,
        branding: localEvent.branding,
        settings: localEvent.settings,
      });
      // Update store with our local copy (already typed correctly)
      setEvent(localEvent);
      toast.success('Settings saved!');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  function updateBranding(key: string, val: unknown) {
    if (!localEvent) return;
    setLocalEvent({ ...localEvent, branding: { ...localEvent.branding, [key]: val } });
  }
  function updateSettings(key: string, val: unknown) {
    if (!localEvent) return;
    setLocalEvent({ ...localEvent, settings: { ...localEvent.settings, [key]: val } });
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Permanently delete this photo?')) return;
    setDeletingId(photoId);
    try {
      const { deletePhoto: del } = await import('@/lib/api');
      await del(photoId);
      setPhotos(p => p.filter(x => x.id !== photoId));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeletingId(null); }
  }

  async function handleZip() {
    if (!storeEvent) return;
    setZipLoading(true);
    try { await downloadPhotosZip(eventId, storeEvent.name); toast.success('Download started!'); }
    catch { toast.error('ZIP failed'); }
    finally { setZipLoading(false); }
  }

  const primaryColor = localEvent?.branding?.primaryColor || '#7c3aed';

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: '📋 Overview' },
    { key: 'branding',   label: '🎨 Branding' },
    { key: 'settings',   label: '⚙️ Settings' },
    { key: 'photos',     label: `📸 Photos${photos.length ? ` (${photos.length})` : ''}` },
    { key: 'diagnostics',label: '🔧 Diagnostics' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0d18] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-600/30 flex items-center justify-center flex-shrink-0">
            <Settings className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm leading-tight">Operator Panel</h2>
            <p className="text-white/40 text-[11px] truncate max-w-[180px]">{storeEvent?.name || 'No event'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-semibold disabled:opacity-50 transition-colors text-white">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* ── Stats — same style as admin page (border, rounded-xl, p-2.5) ── */}
      {stats && (
        <div className="px-4 pt-3 pb-2 bg-[#0d0d18] border-b border-white/10 flex-shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Photos',   value: stats.totalPhotos,      emoji: '📸' },
              { label: 'GIFs',     value: stats.totalGIFs,        emoji: '🎬' },
              { label: 'Strips',   value: stats.totalStrips,      emoji: '🎞️' },
              { label: 'Boom.',    value: stats.totalBoomerangs,  emoji: '🔄' },
              { label: 'AI Used',  value: stats.totalAIGenerated, emoji: '🤖' },
              { label: 'Shares',   value: stats.totalShares,      emoji: '📤' },
              { label: 'Prints',   value: stats.totalPrints,      emoji: '🖨️' },
              { label: 'Sessions', value: stats.totalSessions,    emoji: '👥' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                <div className="text-base mb-0.5">{s.emoji}</div>
                <div className="text-white font-bold text-base leading-tight">{s.value ?? 0}</div>
                <div className="text-white/40 text-[10px] leading-tight mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs — same pill style as admin page ── */}
      <div className="px-4 py-2.5 bg-[#0d0d18] border-b border-white/10 flex-shrink-0">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap text-center ${
                tab === t.key
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-white/50 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-4 bg-[#0a0a0f]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-2xl p-4">
                  <h4 className="text-white font-semibold text-sm mb-3">Event Details</h4>
                  <label className="text-white/40 text-xs block mb-1">Name</label>
                  <input value={localEvent?.name || ''}
                    onChange={e => setLocalEvent({ ...localEvent, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <h4 className="text-white font-semibold text-sm mb-3">Booth URL</h4>
                  <div className="bg-black/40 rounded-xl p-3 mb-3">
                    <code className="text-purple-300 text-xs break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/booth?event=${storeEvent?.slug}` : ''}
                    </code>
                  </div>
                  <button onClick={() => {
                    const url = `${window.location.origin}/booth?event=${storeEvent?.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Copied!');
                  }} className="w-full py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-sm font-medium">
                    📋 Copy URL
                  </button>
                </div>
              </div>
            )}

            {/* BRANDING */}
            {tab === 'branding' && localEvent && (
              <div className="space-y-3">

                {/* ── Group 1: Identity ── */}
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8 bg-white/3">
                    <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest">Identity</h4>
                  </div>
                  <div className="p-4 space-y-4">

                    {/* Brand colour — OPTIONAL */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-white/50 text-xs font-medium">Brand Colour</label>
                        <span className="text-white/25 text-[10px]">Optional — used on idle screen &amp; UI</span>
                      </div>
                      <div className="flex gap-2.5 items-center">
                        <input type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(localEvent.branding?.primaryColor || '') ? localEvent.branding.primaryColor : '#7c3aed'}
                          onChange={e => updateBranding('primaryColor', e.target.value)}
                          className="w-12 h-10 rounded-xl border border-white/20 bg-transparent cursor-pointer p-1 flex-shrink-0" />
                        <input value={localEvent.branding?.primaryColor || ''}
                          onChange={e => updateBranding('primaryColor', e.target.value)}
                          placeholder="Leave blank for default purple"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-purple-500" />
                        {localEvent.branding?.primaryColor && (
                          <button onClick={() => updateBranding('primaryColor', '')}
                            className="text-white/30 hover:text-white/60 text-xs px-2 py-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">✕</button>
                        )}
                      </div>
                      {localEvent.branding?.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(localEvent.branding.primaryColor) && (
                        <div className="mt-2 h-5 rounded-lg w-full" style={{ background: localEvent.branding.primaryColor }} />
                      )}
                    </div>

                    {/* Event name — OPTIONAL */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-white/50 text-xs font-medium">Event Name on Idle Screen</label>
                        <span className="text-white/25 text-[10px]">Optional</span>
                      </div>
                      <div className="relative">
                        <input value={(localEvent.branding?.eventName) || ''}
                          onChange={e => updateBranding('eventName', e.target.value)}
                          placeholder={`Leave blank to use "${localEvent.name}"`}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-8" />
                        {localEvent.branding?.eventName && (
                          <button onClick={() => updateBranding('eventName', '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs px-1">✕</button>
                        )}
                      </div>
                    </div>

                    {/* Logo upload */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-white/50 text-xs font-medium">Logo</label>
                        <span className="text-white/25 text-[10px]">Optional — replaces event name</span>
                      </div>
                      <OperatorUpload label="Logo" accept="image/*"
                        currentUrl={(localEvent.branding?.logoUrl) || ''}
                        onUploaded={url => updateBranding('logoUrl', url)}
                        storagePath={`branding-${eventId}-logo`} />
                      {localEvent.branding?.logoUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={localEvent.branding.logoUrl} alt="logo" className="h-10 w-auto rounded-lg border border-white/10 object-contain bg-white/5 p-1" />
                          <button onClick={() => updateBranding('logoUrl', '')}
                            className="text-white/30 hover:text-red-400 text-xs transition-colors">Remove</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Group 2: Photo Overlays ── */}
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8 bg-white/3">
                    <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest">Photo Overlays</h4>
                    <p className="text-white/25 text-[10px] mt-0.5">Stamped on every captured photo — leave blank for clean photos</p>
                  </div>
                  <div className="p-4 space-y-4">

                    {/* Footer text */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-white/50 text-xs font-medium">Footer Text</label>
                        <span className="text-white/25 text-[10px]">Optional</span>
                      </div>
                      <div className="relative">
                        <input value={(localEvent.branding?.footerText) || ''}
                          onChange={e => updateBranding('footerText', e.target.value)}
                          placeholder="e.g. Sarah & John's Wedding · June 2025"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-8" />
                        {localEvent.branding?.footerText && (
                          <button onClick={() => updateBranding('footerText', '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs px-1">✕</button>
                        )}
                      </div>
                    </div>

                    {/* Overlay / hashtag */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-white/50 text-xs font-medium">Top Overlay / Hashtag</label>
                        <span className="text-white/25 text-[10px]">Optional</span>
                      </div>
                      <div className="relative">
                        <input value={(localEvent.branding?.overlayText) || ''}
                          onChange={e => updateBranding('overlayText', e.target.value)}
                          placeholder="#YourHashtag2025"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 pr-8" />
                        {localEvent.branding?.overlayText && (
                          <button onClick={() => updateBranding('overlayText', '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs px-1">✕</button>
                        )}
                      </div>
                    </div>

                    {/* Show date toggle */}
                    <label className="flex items-center justify-between py-2.5 cursor-pointer group">
                      <div>
                        <p className="text-white/70 text-sm">Show date on photos</p>
                        <p className="text-white/25 text-[10px]">Prints today's date in footer bar</p>
                      </div>
                      <div className="relative">
                        <input type="checkbox"
                          checked={(localEvent.branding?.showDate) ?? false}
                          onChange={e => updateBranding('showDate', e.target.checked)}
                          className="w-5 h-5 accent-purple-500 cursor-pointer" />
                      </div>
                    </label>

                    {/* Photo frame overlay */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-white/50 text-xs font-medium">Photo Frame (PNG overlay)</label>
                        <span className="text-white/25 text-[10px]">Optional</span>
                      </div>
                      <p className="text-white/25 text-[10px] mb-2">PNG with transparency, composited on every photo at capture</p>
                      <OperatorUpload label="Frame PNG" accept="image/png"
                        currentUrl={(localEvent.branding?.frameUrl) || ''}
                        onUploaded={url => updateBranding('frameUrl', url)}
                        storagePath={`branding-${eventId}-frame`} />
                      <input value={(localEvent.branding?.frameUrl) || ''}
                        onChange={e => updateBranding('frameUrl', e.target.value)}
                        placeholder="Or paste URL..."
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-purple-500" />
                      {localEvent.branding?.frameUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={localEvent.branding.frameUrl} alt="frame" className="mt-2 w-full max-h-24 object-contain rounded-xl border border-white/10 bg-white/5 p-1" />
                      )}
                    </div>

                    {/* Photo preview */}
                    {(localEvent.branding?.footerText || localEvent.branding?.overlayText || localEvent.branding?.showDate) ? (
                      <div>
                        <p className="text-white/30 text-[10px] mb-2 uppercase tracking-widest">Live Preview</p>
                        <div className="rounded-xl overflow-hidden relative bg-[#1a1a2e]" style={{ aspectRatio: '4/3' }}>
                          <div className="absolute inset-0 flex items-center justify-center text-white/15 text-xs">📷 photo area</div>
                          {localEvent.branding?.overlayText && (
                            <div className="absolute top-0 left-0 right-0 bg-black/50 px-3 py-1.5">
                              <span className="text-white text-xs font-bold">{localEvent.branding.overlayText}</span>
                            </div>
                          )}
                          {(localEvent.branding?.footerText || localEvent.branding?.showDate) && (
                            <div className="absolute bottom-0 left-0 right-0 py-2 px-3 text-center"
                              style={{ background: `${localEvent.branding?.primaryColor || '#7c3aed'}ee` }}>
                              {localEvent.branding?.footerText && <p className="text-white text-xs font-bold">{localEvent.branding.footerText}</p>}
                              {localEvent.branding?.showDate && <p className="text-white/70 text-[10px]">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-green-500/8 border border-green-500/20 px-3 py-2.5 flex items-center gap-2">
                        <span className="text-green-400 text-sm">✓</span>
                        <p className="text-green-400/80 text-xs">Clean photos — no text overlay</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Group 3: Idle Screen Media ── */}
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8 bg-white/3">
                    <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest">Idle Screen</h4>
                    <p className="text-white/25 text-[10px] mt-0.5">Background shown when booth is waiting</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-white/50 text-xs font-medium">Loop Video or Image</label>
                      <span className="text-white/25 text-[10px]">Optional</span>
                    </div>
                    <p className="text-white/25 text-[10px] mb-2">MP4 or image plays on loop behind the tap-to-start prompt</p>
                    <OperatorUpload label="Video/Image" accept="video/mp4,video/webm,image/*"
                      currentUrl={(localEvent.branding?.idleMediaUrl) || ''}
                      onUploaded={url => updateBranding('idleMediaUrl', url)}
                      storagePath={`branding-${eventId}-idle`} />
                    <input value={(localEvent.branding?.idleMediaUrl) || ''}
                      onChange={e => updateBranding('idleMediaUrl', e.target.value)}
                      placeholder="Or paste URL..."
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-purple-500" />
                    {localEvent.branding?.idleMediaUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
                        {(localEvent.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i)
                          ? <video src={localEvent.branding.idleMediaUrl} muted autoPlay loop playsInline className="w-full max-h-28 object-cover" />
                          : /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={localEvent.branding.idleMediaUrl} alt="idle" className="w-full max-h-28 object-cover" />
                        }
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* SETTINGS */}
            {tab === 'settings' && localEvent && (
              <div className="space-y-3">
                <div className="bg-white/5 rounded-2xl p-4">
                  <h4 className="text-white font-semibold text-sm mb-3">Features</h4>
                  {[
                    { key: 'allowAI', label: '🤖 AI Generation' },
                    { key: 'allowGIF', label: '🎬 GIF Mode' },
                    { key: 'allowBoomerang', label: '🔄 Boomerang' },
                    { key: 'allowPrint', label: '🖨️ Print' },
                    { key: 'allowRetakes', label: '🔁 Retakes' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 cursor-pointer">
                      <span className="text-white/80 text-sm">{item.label}</span>
                      <input type="checkbox"
                        checked={(localEvent.settings?.[item.key]) ?? true}
                        onChange={e => updateSettings(item.key, e.target.checked)}
                        className="w-5 h-5 accent-purple-500" />
                    </label>
                  ))}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <h4 className="text-white font-semibold text-sm">Timing & Security</h4>
                  {[
                    { key: 'countdownSeconds', label: 'Countdown', options: [1,2,3,5,10], suffix: 's' },
                    { key: 'sessionTimeout', label: 'Session Timeout', options: [30,60,90,120,180], suffix: 's' },
                    { key: 'photosPerSession', label: 'Photos per session', options: [1,2,3,4], suffix: '' },
                    { key: 'printCopies', label: 'Print copies', options: [1,2,3,4], suffix: '' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-white/40 text-xs block mb-1">{f.label}</label>
                      <select value={(localEvent.settings?.[f.key]) || f.options[0]}
                        onChange={e => updateSettings(f.key, Number(e.target.value))}
                        className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500">
                        {f.options.map(n => <option key={n} value={n}>{n}{f.suffix}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Operator PIN</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                      value={(localEvent.settings?.operatorPin) || '1234'}
                      onChange={e => updateSettings('operatorPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-xl tracking-[0.4em] font-mono focus:outline-none focus:border-purple-500" />
                    <p className="text-white/20 text-xs mt-1">4–8 digits. Used to open this panel.</p>
                  </div>
                </div>
              </div>
            )}

            {/* PHOTOS */}
            {tab === 'photos' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/50 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />Live
                  </span>
                  <button onClick={handleZip} disabled={zipLoading || photos.length === 0}
                    className="text-xs px-3 py-2 rounded-xl bg-purple-600/20 text-purple-300 disabled:opacity-40 flex items-center gap-1.5">
                    {zipLoading ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : '📦'}
                    {zipLoading ? '...' : `Download All (${photos.length})`}
                  </button>
                </div>
                {photos.length === 0
                  ? <div className="text-center py-16 text-white/20 text-sm">No photos yet</div>
                  : (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.thumb_url || photo.url} alt="photo" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1.5">
                            <a href={photo.url} target="_blank" rel="noreferrer"
                              className="w-full py-1.5 rounded-lg bg-white/20 text-white text-xs text-center">View</a>
                            <button onClick={() => handleDeletePhoto(photo.id)} disabled={deletingId === photo.id}
                              className="w-full py-1.5 rounded-lg bg-red-500/30 text-red-300 text-xs disabled:opacity-40">
                              {deletingId === photo.id ? '...' : '🗑️ Wipe'}
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5 text-[10px] text-white/60">
                            {photo.mode === 'gif' ? '🎬' : photo.mode === 'boomerang' ? '🔄' : photo.mode === 'strip' ? '🎞️' : '📸'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* DIAGNOSTICS */}
            {tab === 'diagnostics' && <DiagnosticsPanel />}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Gear icon trigger — exported to IdleScreen ────────────────────────────
// onOpenChange: called with true when PIN/panel opens, false when closed.
// IdleScreen uses this to block booth start while operator UI is visible.
export function OperatorPanelTrigger({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { event } = useBoothStore();
  const [phase, setPhase] = useState<'idle' | 'pin' | 'panel'>('idle');
  const correctPin = (event?.settings?.operatorPin) || '1234';

  function openPin(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    setPhase('pin');
    onOpenChange?.(true);
  }

  function closeAll() {
    setPhase('idle');
    onOpenChange?.(false);
  }

  return (
    <>
      {/* Gear button — only visible when idle */}
      {phase === 'idle' && (
        <button
          onPointerDown={openPin}
          className="absolute bottom-5 right-5 z-30 w-11 h-11 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-black/60 transition-all select-none"
          aria-label="Operator Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}

      <AnimatePresence>
        {phase === 'pin' && (
          <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onPointerDown={e => e.stopPropagation()}
          >
            <PinEntry
              correctPin={correctPin}
              onSuccess={() => { setPhase('panel'); }}
              onCancel={closeAll}
            />
          </motion.div>
        )}
        {phase === 'panel' && (
          <OperatorPanel key="panel" onClose={closeAll} />
        )}
      </AnimatePresence>
    </>
  );
}
