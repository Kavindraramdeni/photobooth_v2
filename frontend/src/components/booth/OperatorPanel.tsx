'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Loader2, Camera, Printer, Wifi, Cloud,
  RefreshCw, Activity, Download, Trash2, ExternalLink,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { useBoothStore } from '@/lib/store';
import {
  updateEvent, getEventPhotos, deletePhoto,
  downloadPhotosZip, getEventQR, pingBackend
} from '@/lib/api';
import toast from 'react-hot-toast';

type OTab = 'diagnostics' | 'overview' | 'branding' | 'settings' | 'photos';

const OTABS: { id: OTab; label: string; emoji: string }[] = [
  { id: 'diagnostics', label: 'Diagnostics', emoji: '🔧' },
  { id: 'overview',    label: 'Overview',    emoji: '📋' },
  { id: 'branding',   label: 'Branding',    emoji: '🎨' },
  { id: 'settings',   label: 'Settings',    emoji: '⚙️' },
  { id: 'photos',     label: 'Photos',      emoji: '📸' },
];

type DiagStatus = 'checking' | 'ok' | 'warn' | 'error';

interface Photo {
  id: string; url: string; thumb_url?: string; mode: string; created_at: string;
}

interface Props {
  onClose: () => void;
}

function StatusDot({ s }: { s: DiagStatus }) {
  const c = { checking: 'bg-white/40 animate-pulse', ok: 'bg-green-400', warn: 'bg-yellow-400', error: 'bg-red-400' };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[s]}`} />;
}

export function OperatorPanel({ onClose }: Props) {
  const { event, setEvent: setStoreEvent } = useBoothStore();
  const [tab, setTab] = useState<OTab>('diagnostics');
  const [localEvent, setLocalEvent] = useState<Record<string, any> | null>(event ? JSON.parse(JSON.stringify(event)) : null);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [qrData, setQrData] = useState<any>(null);

  // Diagnostics state
  const [latency, setLatency] = useState<number | null>(null);
  const [netStatus, setNetStatus] = useState<DiagStatus>('checking');
  const [camStatus, setCamStatus] = useState<DiagStatus>('checking');
  const [testCapturing, setTestCapturing] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);

  // Run diagnostics on mount
  useEffect(() => {
    runDiag();
  }, []);

  async function runDiag() {
    setNetStatus('checking');
    setCamStatus('checking');

    // Network + backend
    if (navigator.onLine) {
      try {
        const ms = await pingBackend();
        setLatency(ms);
        setNetStatus(ms < 500 ? 'ok' : ms < 1000 ? 'warn' : 'error');
      } catch {
        setNetStatus('error');
      }
    } else {
      setNetStatus('error');
    }

    // Camera
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      setCamStatus(cams.length > 0 ? 'ok' : 'error');
    } catch {
      setCamStatus('warn');
    }
  }

  // Load photos when photos tab opens
  useEffect(() => {
    if (tab === 'photos' && event?.id) {
      setPhotosLoading(true);
      getEventPhotos(event.id)
        .then((d) => setPhotos(d.photos || []))
        .catch(() => toast.error('Failed to load photos'))
        .finally(() => setPhotosLoading(false));
    }
  }, [tab, event?.id]);

  // Load QR on overview tab
  useEffect(() => {
    if (tab === 'overview' && !qrData && event?.id) {
      getEventQR(event.id).then(setQrData).catch(() => {});
    }
  }, [tab, qrData, event?.id]);

  function updateBranding(key: string, value: unknown) {
    if (!localEvent) return;
    setLocalEvent({ ...localEvent, branding: { ...localEvent.branding, [key]: value } });
  }

  function updateSettings(key: string, value: unknown) {
    if (!localEvent) return;
    setLocalEvent({ ...localEvent, settings: { ...localEvent.settings, [key]: value } });
  }

  async function handleSave() {
    if (!localEvent) return;
    setSaving(true);
    try {
      const updated = await updateEvent(localEvent.id, {
        name: localEvent.name,
        venue: localEvent.venue,
        date: localEvent.date,
        branding: localEvent.branding,
        settings: localEvent.settings,
      });
      setStoreEvent(updated);
      toast.success('✅ Settings saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Permanently delete this photo?')) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
      setPhotos((p) => p.filter((x) => x.id !== photoId));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTestCapture() {
    setTestCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCamStatus('ok');
      toast.success('✅ Camera verified!');
    } catch (err: unknown) {
      setCamStatus('error');
      toast.error(`Camera error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setTestCapturing(false);
    }
  }

  async function handleTestPrint() {
    setTestPrinting(true);
    try {
      const w = window.open('', '_blank', 'width=400,height=500');
      if (!w) throw new Error('Popup blocked');
      w.document.write(`<html><head><title>Test Print</title>
        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;
        height:100vh;font-family:sans-serif;} .box{border:3px solid #7c3aed;border-radius:16px;
        padding:32px;text-align:center;}</style></head>
        <body><div class="box"><div style="font-size:48px">📸</div>
        <h2 style="color:#7c3aed;margin:12px 0">SnapBooth AI</h2>
        <p style="color:#666">Test Print — ${new Date().toLocaleString()}</p></div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),2000)}<\/script>
        </body></html>`);
      w.document.close();
      toast.success('🖨️ Test print sent!');
    } catch {
      toast.error('Could not open print window');
    } finally {
      setTestPrinting(false);
    }
  }

  if (!localEvent) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0a0a0f]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-sm">⚙️</div>
          <div>
            <h2 className="text-white font-bold">Operator Panel</h2>
            <p className="text-white/40 text-xs">{localEvent.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/40 px-4 py-2 overflow-x-auto border-b border-white/10">
        {OTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-purple-600 text-white font-semibold' : 'text-white/50 hover:text-white'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── DIAGNOSTICS ─────────────────────────────────────────────── */}
        {tab === 'diagnostics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Network */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className={`w-4 h-4 ${netStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-white/60 text-sm">Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot s={netStatus} />
                  <span className="text-white font-semibold capitalize">{netStatus === 'checking' ? '...' : netStatus}</span>
                </div>
                {latency !== null && <p className="text-white/40 text-xs mt-1">{latency}ms</p>}
              </div>

              {/* Camera */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className={`w-4 h-4 ${camStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-white/60 text-sm">Camera</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot s={camStatus} />
                  <span className="text-white font-semibold capitalize">{camStatus === 'checking' ? '...' : camStatus}</span>
                </div>
              </div>
            </div>

            {/* Cloud sync */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-semibold">Cloud Sync</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${netStatus === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {netStatus === 'ok' ? 'Connected' : 'Degraded'}
                </span>
              </div>
              <p className="text-white/40 text-xs">Supabase Storage · Real-time upload on capture · 0 pending</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleTestCapture}
                disabled={testCapturing}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-600/30 transition-colors disabled:opacity-50"
              >
                {testCapturing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                Verify Shutter
              </button>
              <button
                onClick={handleTestPrint}
                disabled={testPrinting}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                {testPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                Fire Test Print
              </button>
            </div>

            <button
              onClick={runDiag}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Re-run Diagnostics
            </button>
          </div>
        )}

        {/* ── OVERVIEW ────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">Event Details</h3>
              {[
                { label: 'Event Name', key: 'name' },
                { label: 'Venue', key: 'venue' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-white/50 text-xs block mb-1">{f.label}</label>
                  <input
                    value={localEvent[f.key] || ''}
                    onChange={(e) => setLocalEvent({ ...localEvent, [f.key]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              ))}
            </div>

            {/* QR codes */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold mb-3">QR Codes</h3>
              {!qrData ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-center">
                  {[
                    { label: 'Booth', qr: qrData.boothQR },
                    { label: 'Gallery', qr: qrData.galleryQR },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="bg-white rounded-xl p-2 inline-block mb-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.qr} alt={item.label} className="w-24 h-24" />
                      </div>
                      <p className="text-white/60 text-xs">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BRANDING ────────────────────────────────────────────────── */}
        {tab === 'branding' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold">🎨 Branding</h3>

              {/* Color */}
              <div>
                <label className="text-white/50 text-xs block mb-1">Brand Color</label>
                <div className="flex gap-3">
                  <input type="color" value={localEvent.branding?.primaryColor || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer"
                  />
                  <input value={localEvent.branding?.primaryColor || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {[
                { key: 'eventName', label: 'Event Header Name', placeholder: 'Shown on idle screen' },
                { key: 'footerText', label: 'Footer Text (on photos)', placeholder: "Sarah & John's Wedding" },
                { key: 'overlayText', label: 'Overlay Text (top of photo)', placeholder: '#hashtag' },
                { key: 'logoUrl', label: 'Logo URL', placeholder: 'https://... PNG' },
                { key: 'idleMediaUrl', label: 'Booth Loop (Idle Media URL)', placeholder: 'https://... MP4 or image' },
                { key: 'frameUrl', label: 'Photo Frame Overlay URL', placeholder: 'https://... transparent PNG' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-white/50 text-xs block mb-1">{f.label}</label>
                  <input
                    value={localEvent.branding?.[f.key] || ''}
                    onChange={(e) => updateBranding(f.key, e.target.value || null)}
                    placeholder={f.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder-white/20"
                  />
                </div>
              ))}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={localEvent.branding?.showDate ?? true}
                  onChange={(e) => updateBranding('showDate', e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-white/70 text-sm">Show date on photos</span>
              </label>
            </div>
          </div>
        )}

        {/* ── SETTINGS ────────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold mb-4">⚙️ Features</h3>
              <div className="space-y-1">
                {[
                  { key: 'allowAI', label: '🤖 AI Generation' },
                  { key: 'allowGIF', label: '🎬 GIF Mode' },
                  { key: 'allowBoomerang', label: '🔄 Boomerang' },
                  { key: 'allowPrint', label: '🖨️ Print' },
                  { key: 'allowRetakes', label: '🔁 Retakes' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 cursor-pointer">
                    <span className="text-white/80 text-sm">{item.label}</span>
                    <input type="checkbox"
                      checked={localEvent.settings?.[item.key] ?? true}
                      onChange={(e) => updateSettings(item.key, e.target.checked)}
                      className="w-5 h-5 accent-purple-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold">⏱ Timing & Security</h3>
              {[
                { label: 'Countdown (seconds)', key: 'countdownSeconds', options: [1, 2, 3, 5, 10] },
                { label: 'Session Timeout (seconds)', key: 'sessionTimeout', options: [30, 60, 90, 120, 180] },
                { label: 'Print Copies', key: 'printCopies', options: [1, 2, 3, 4] },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-white/50 text-xs block mb-1">{f.label}</label>
                  <select
                    value={localEvent.settings?.[f.key] || f.options[0]}
                    onChange={(e) => updateSettings(f.key, Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {f.options.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-white/50 text-xs block mb-1">Operator PIN</label>
                <input
                  type="password"
                  value={localEvent.settings?.operatorPin || '1234'}
                  onChange={(e) => updateSettings('operatorPin', e.target.value)}
                  maxLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── PHOTOS ──────────────────────────────────────────────────── */}
        {tab === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">{photos.length} Photos
                <span className="ml-2 text-xs text-green-400 font-normal"><Activity className="w-3 h-3 inline" /> Live</span>
              </span>
              <button
                onClick={() => { setZipping(true); downloadPhotosZip(event!.id, event!.name); setTimeout(() => setZipping(false), 2000); }}
                disabled={zipping || photos.length === 0}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {zipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                ZIP All
              </button>
            </div>

            {photosLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-white/40" /></div>
            ) : photos.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-4xl mb-3">📸</div>
                <p>No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumb_url || photo.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                      <a href={photo.url} target="_blank" rel="noreferrer"
                        className="w-full text-center bg-white/20 rounded py-1 text-white text-xs">Open</a>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletingId === photo.id}
                        className="w-full bg-red-500/50 rounded py-1 text-white text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {deletingId === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Wipe
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5 text-xs text-white/60">{photo.mode}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
}
