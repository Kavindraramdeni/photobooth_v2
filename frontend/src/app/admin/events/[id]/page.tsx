'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Palette, Camera, Share2, Printer, Image as ImageIcon,
  ShieldCheck, BarChart3, UploadCloud, X,
  ChevronLeft, Copy, ExternalLink, Save, RefreshCw, Trash2, EyeOff, Eye,
  Download, Smartphone, AlertCircle, Clapperboard, Sparkles, Film, RotateCcw,
  Mail, MessageSquare, Wifi, Globe, Clock, Lock, Users, Activity,
  CheckCircle, XCircle, Zap, FileText, Hash
} from 'lucide-react';
import {
  getEvent, updateEvent, getEventPhotos, getEventStats, deletePhoto,
  downloadPhotosZip, pingBackend, hidePhoto, unhidePhoto, getEventLeads,
  exportLeadsCSV, getEventPhotosWithHidden, testWebhook, exportAnalyticsCSV,
  getEventAnalytics
} from '@/lib/api';
import toast from 'react-hot-toast';
import { LiveDashboard } from '@/components/admin/LiveDashboard';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'overview' | 'branding' | 'capture' | 'sharing' | 'print' | 'photos' | 'moderation' | 'leads' | 'analytics' | 'diagnostics';

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

// ── Premium Toggle ────────────────────────────────────────────────────────────
function PremiumToggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
        checked ? 'bg-violet-600' : 'bg-zinc-700'
      }`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Section Card wrapper ──────────────────────────────────────────────────────
function Card({ title, subtitle, icon: Icon, children, className = '' }: {
  title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-violet-400" />}
            {title}
          </h3>
          {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ icon: Icon, label, desc, checked, onChange }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; desc?: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between group py-0.5">
      <div className="flex gap-3 items-center">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-violet-500/40 transition-colors flex-shrink-0">
            <Icon className="w-4 h-4 text-zinc-400 group-hover:text-violet-400 transition-colors" />
          </div>
        )}
        <div>
          <p className="text-zinc-200 text-sm font-medium">{label}</p>
          {desc && <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
      <PremiumToggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">{children}</label>;
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors ${className}`} />
  );
}

// ── Upload button ─────────────────────────────────────────────────────────────
async function uploadAssetViaBackend(file: File, eventId: string, type: 'logo' | 'frame' | 'idle'): Promise<string> {
  const token = localStorage.getItem('sb_access_token');
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/events/${eventId}/upload-asset?type=${type}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error || 'Upload failed'); }
  const { url } = await res.json();
  return url;
}

function UploadZone({ label, accept, currentUrl, onUploaded, uploading, setUploading, eventId, assetType }: {
  label: string; accept: string; currentUrl: string; onUploaded: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void; eventId: string; assetType: 'logo' | 'frame' | 'idle';
}) {
  const ref = useRef<HTMLInputElement>(null);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadAssetViaBackend(file, eventId, assetType); onUploaded(url); toast.success(`${label} uploaded!`); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <div onClick={() => !uploading && ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
          uploading ? 'border-zinc-700 bg-zinc-900/30 opacity-50 cursor-not-allowed'
                    : 'border-zinc-700 hover:border-violet-500 hover:bg-violet-500/5 bg-zinc-900/30'
        }`}>
        <UploadCloud className={`w-5 h-5 ${uploading ? 'text-zinc-600 animate-bounce' : 'text-violet-400'}`} />
        <span className="text-sm font-medium text-zinc-300">{uploading ? 'Uploading...' : `Upload ${label}`}</span>
        <span className="text-xs text-zinc-600">PNG, JPG, MP4 supported</span>
      </div>
      {currentUrl && (
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
          <p className="text-zinc-400 text-xs truncate max-w-[200px]">{currentUrl.split('/').pop()}</p>
          <button onClick={() => onUploaded('')} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs ml-2 flex-shrink-0">
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Test Email Button ─────────────────────────────────────────────────────────
function TestEmailButton({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  async function sendTest() {
    if (!email.trim()) return; setSending(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${API_BASE}/api/share/test-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ toEmail: email.trim(), eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Test sent to ${email}`); setEmail('');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSending(false); }
  }
  return (
    <div className="flex gap-2">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && sendTest()}
        className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors" />
      <button onClick={sendTest} disabled={!email.trim() || sending}
        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex-shrink-0">
        {sending ? '⏳' : 'Send'}
      </button>
    </div>
  );
}

// ── Diagnostics Panel ─────────────────────────────────────────────────────────
function DiagnosticsPanel({ eventId }: { eventId: string }) {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [aiStatus, setAiStatus]   = useState<Record<string, unknown> | null>(null);
  const [checking, setChecking]   = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = await pingBackend(); setBackendOk(result.ok);
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${API_BASE}/api/ai/status`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) setAiStatus(await res.json());
    } catch { setBackendOk(false); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { check(); }, [check]);

  function StatusRow({ label, ok, value, sub }: { label: string; ok: boolean | null; value: string; sub?: string }) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
        <div>
          <p className="text-zinc-200 text-sm font-medium">{label}</p>
          {sub && <p className="text-zinc-500 text-xs mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-300 text-sm">{value}</span>
          {ok === true && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {ok === false && <XCircle className="w-4 h-4 text-red-400" />}
          {ok === null && <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card title="System Status" subtitle="Live connection check" icon={Activity}>
        <div className="space-y-0">
          <StatusRow label="Backend API" ok={backendOk} value={backendOk === null ? 'Checking...' : backendOk ? 'Connected' : 'Offline'} sub="Render.com backend service" />
          <StatusRow label="AI Service" ok={aiStatus !== null} value={aiStatus ? (aiStatus.activeTier as string || 'Configured') : 'Checking...'} sub={aiStatus ? `Tier: ${aiStatus.tier || 'Sharp local filters'}` : 'Checking AI tier'} />
        </div>
        <button onClick={check} disabled={checking}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Refresh Status
        </button>
      </Card>

      <Card title="Test Print" subtitle="Send a test page to verify printer connection" icon={Printer}>
        <p className="text-zinc-500 text-sm mb-4">Opens a print dialog to confirm your printer is detected and paper size is correct.</p>
        <button onClick={() => {
          const w = window.open('', '_blank', 'width=400,height=500');
          if (w) {
            w.document.write(`<!DOCTYPE html><html><head><title>SnapBooth Print Test</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:4in;height:6in;overflow:hidden}@page{size:4in 6in portrait;margin:0}.p{position:absolute;top:0;left:0;width:4in;height:6in;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;font-family:Arial,sans-serif;gap:8px}.box{border:3px dashed #7c3aed;border-radius:12px;padding:24px;text-align:center}h1{color:#7c3aed;font-size:22px;margin-bottom:8px}p{color:#555;font-size:12px}</style></head><body><div class="p"><div class="box"><h1>SnapBooth AI</h1><p>Test print successful</p><p style="font-size:10px;color:#999;margin-top:12px">${new Date().toLocaleString()}</p></div></div><script>setTimeout(function(){window.print();window.close()},600)</script></body></html>`);
            w.document.close();
          }
        }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 font-semibold text-sm hover:bg-violet-600/30 transition-colors">
          <Printer className="w-4 h-4" /> Send Test Page
        </button>
      </Card>

      <Card title="System Reset" icon={RefreshCw}>
        <p className="text-zinc-500 text-sm mb-4">Clears all active streams and reloads the booth. Use if the camera or printer freezes.</p>
        <button onClick={() => window.location.reload()}
          className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm border border-red-500/20 transition-all">
          Reload Booth
        </button>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const [zipLoading, setZipLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<'ok' | 'fail' | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIdle, setUploadingIdle] = useState(false);
  const [uploadingFrame, setUploadingFrame] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ev, st, ph] = await Promise.all([
          getEvent(eventId), getEventStats(eventId), getEventPhotosWithHidden(eventId),
        ]);
        setEvent(ev); setStats(st); setPhotos(ph.photos || []);
      } catch { toast.error('Event not found'); router.push('/admin'); }
      finally { setLoading(false); }
    }
    load();
  }, [eventId, router]);

  useEffect(() => {
    if (tab === 'leads' && event && leads.length === 0 && !leadsLoading) handleLoadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, event?.id]);

  async function handleSave() {
    if (!event) return;
    setSaving(true);
    try {
      await updateEvent(event.id, { name: event.name, venue: event.venue, date: event.date, branding: event.branding, settings: event.settings });
      setIsDirty(false);
      toast.success('Changes saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  function updateBranding(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, branding: { ...event.branding, [key]: value } });
    setIsDirty(true);
  }

  function updateSettings(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, settings: { ...event.settings, [key]: value } });
    setIsDirty(true);
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Permanently delete this photo?')) return;
    setDeletingId(photoId);
    try { await deletePhoto(photoId); setPhotos(prev => prev.filter(p => p.id !== photoId)); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
    finally { setDeletingId(null); }
  }

  async function handleToggleHide(photo: Photo) {
    setModeratingId(photo.id);
    try {
      if (photo.is_hidden) { await unhidePhoto(photo.id); setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_hidden: false } : p)); toast.success('Photo restored'); }
      else { await hidePhoto(photo.id, 'operator'); setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_hidden: true } : p)); toast.success('Photo hidden'); }
    } catch { toast.error('Action failed'); }
    finally { setModeratingId(null); }
  }

  async function handleZip() {
    if (!event) return; setZipLoading(true);
    try { await downloadPhotosZip(event.id, event.name); toast.success('Download started'); }
    catch { toast.error('ZIP failed'); }
    finally { setZipLoading(false); }
  }

  async function handleLoadLeads() {
    if (!event || leadsLoading) return; setLeadsLoading(true);
    try { const data = await getEventLeads(event.id); setLeads(data.leads || []); }
    catch { toast.error('Could not load leads'); }
    finally { setLeadsLoading(false); }
  }

  const boothUrl = event ? `${typeof window !== 'undefined' ? window.location.origin : ''}/booth?event=${event.slug}` : '';
  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm animate-pulse">Loading event...</p>
      </div>
    </div>
  );
  if (!event) return null;

  const visiblePhotos = photos.filter(p => !p.is_hidden);
  const hiddenPhotos  = photos.filter(p => p.is_hidden);

  const NAV: { section: string; icon: React.ComponentType<{ className?: string }>; tabs: { key: Tab; label: string; badge?: number }[] }[] = [
    { section: 'Event',   icon: LayoutDashboard, tabs: [{ key: 'overview', label: 'Overview' }] },
    { section: 'Design',  icon: Palette,         tabs: [{ key: 'branding', label: 'Branding' }] },
    { section: 'Booth',   icon: Camera,          tabs: [{ key: 'capture',  label: 'Capture & Modes' }] },
    { section: 'Share',   icon: Share2,          tabs: [{ key: 'sharing',  label: 'Sharing & Email' }] },
    { section: 'Print',   icon: Printer,         tabs: [{ key: 'print',    label: 'Print Setup' }] },
    { section: 'Gallery', icon: ImageIcon,       tabs: [
      { key: 'photos',     label: 'Photos',     badge: visiblePhotos.length || undefined },
      { key: 'moderation', label: 'Moderation', badge: hiddenPhotos.length || undefined },
      { key: 'leads',      label: 'Leads',      badge: leads.length || undefined },
    ]},
    { section: 'Data',    icon: BarChart3,       tabs: [
      { key: 'analytics',   label: 'Analytics' },
      { key: 'diagnostics', label: 'Diagnostics' },
    ]},
  ];

  return (
    <div className="min-h-screen bg-[#09090b] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.08),transparent)] text-zinc-50 flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 gap-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-white/5">
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-6 bg-white/[0.07]" />
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-bold text-lg tracking-tight truncate">{event.name}</h1>
                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  event.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${event.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {event.status}
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-0.5 hidden sm:block">{event.venue || 'No venue'} · {event.date?.split('T')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Stats pills */}
            {stats && (
              <div className="hidden lg:flex items-center gap-2">
                {[
                  { v: stats.totalPhotos, l: 'Photos' },
                  { v: stats.totalShares, l: 'Shares' },
                  { v: stats.totalPrints, l: 'Prints' },
                ].map(s => (
                  <div key={s.l} className="text-center bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-1.5">
                    <div className="text-white font-bold text-sm leading-none">{s.v ?? 0}</div>
                    <div className="text-zinc-500 text-[9px] mt-0.5 uppercase tracking-wide">{s.l}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Copy URL */}
            <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('URL copied!'); }}
              className="hidden sm:flex items-center gap-2 text-xs bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 px-3 py-2 rounded-lg transition-colors text-zinc-300">
              <Copy className="w-3.5 h-3.5" /> Copy URL
            </button>
            {/* Save — always visible, dims when clean */}
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300'
              }`}>
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
            </button>
            {/* Open Booth — fullscreen */}
            <button
              onClick={() => {
                const url = `/booth?event=${event.slug}`;
                const w = window.open(url, '_blank');
                if (w) {
                  w.addEventListener('load', () => {
                    const el = w.document.documentElement;
                    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
                    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
                  });
                }
              }}
              className="flex items-center gap-2 text-xs bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors font-semibold shadow-lg shadow-violet-500/20">
              <ExternalLink className="w-3.5 h-3.5" /> Open Booth
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden max-w-[1600px] w-full mx-auto">

        {/* ── Sidebar ── */}
        <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-white/[0.04] overflow-y-auto py-5 px-3">
          <nav className="flex-1 space-y-5">
            {NAV.map(group => (
              <div key={group.section}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 flex items-center gap-1.5">
                  <group.icon className="w-3 h-3" /> {group.section}
                </p>
                <div className="space-y-0.5">
                  {group.tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        tab === t.key ? 'bg-violet-500/10 text-violet-300 font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                      }`}>
                      <span>{t.label}</span>
                      {t.badge !== undefined && t.badge > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center ${
                          tab === t.key ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'
                        }`}>{t.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>


        </aside>

        {/* ── Mobile tabs ── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-zinc-950/95 backdrop-blur border-t border-white/[0.06] flex overflow-x-auto scrollbar-none px-2 py-1.5 gap-1">
          {NAV.flatMap(g => g.tabs).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="text-[9px] bg-white/20 rounded px-1">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-7">
            <AnimatePresence mode="wait">
              <motion.div key={tab}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="space-y-5">

                {/* ══ OVERVIEW ══ */}
                {tab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Card title="Event Details" icon={LayoutDashboard}>
                      <div className="space-y-4">
                        <div><FieldLabel>Event Name</FieldLabel>
                          <Input value={event.name} onChange={v => { setEvent({ ...event, name: v }); setIsDirty(true); }} /></div>
                        <div><FieldLabel>Venue</FieldLabel>
                          <Input value={event.venue || ''} onChange={v => { setEvent({ ...event, venue: v }); setIsDirty(true); }} placeholder="Grand Ballroom, Mumbai" /></div>
                        <div><FieldLabel>Date</FieldLabel>
                          <input type="date" value={event.date?.split('T')[0] || ''}
                            onChange={e => { setEvent({ ...event, date: e.target.value }); setIsDirty(true); }}
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors block" /></div>
                      </div>
                    </Card>

                    <Card title="Kiosk Access" subtitle="Share with your operator" icon={Smartphone}>
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
                      {stats && (
                        <div className="grid grid-cols-4 gap-2 mt-4">
                          {[
                            { v: stats.totalPhotos, l: 'Photos', e: '📸' },
                            { v: stats.totalGIFs, l: 'GIFs', e: '🎬' },
                            { v: stats.totalShares, l: 'Shares', e: '📤' },
                            { v: stats.totalPrints, l: 'Prints', e: '🖨️' },
                          ].map(s => (
                            <div key={s.l} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-center">
                              <div className="text-sm mb-0.5">{s.e}</div>
                              <div className="text-white font-bold text-base leading-none">{s.v ?? 0}</div>
                              <div className="text-zinc-600 text-[9px] mt-0.5 uppercase">{s.l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* ══ BRANDING ══ */}
                {tab === 'branding' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="space-y-5">
                      <Card title="Identity" subtitle="Brand colour, logo, event name" icon={Palette}>
                        <div className="space-y-5">
                          <div>
                            <FieldLabel>Brand Colour</FieldLabel>
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-zinc-700 flex-shrink-0 cursor-pointer" style={{ background: primaryColor }}>
                                <input type="color" value={primaryColor} onChange={e => updateBranding('primaryColor', e.target.value)}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                              </div>
                              <Input value={primaryColor} onChange={v => updateBranding('primaryColor', v)} placeholder="#7c3aed" />
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Event Display Name</FieldLabel>
                            <Input value={(event.branding?.eventName as string) || ''} onChange={v => updateBranding('eventName', v)} placeholder={event.name} />
                          </div>
                          <div>
                            <FieldLabel>Logo</FieldLabel>
                            <UploadZone label="logo" accept="image/*" currentUrl={(event.branding?.logoUrl as string) || ''}
                              onUploaded={url => updateBranding('logoUrl', url)}
                              uploading={uploadingLogo} setUploading={setUploadingLogo}
                              eventId={event.id} assetType="logo" />
                          </div>
                        </div>
                      </Card>

                      <Card title="Photo Overlay" subtitle="Appears on every captured photo" icon={ImageIcon}>
                        <div className="space-y-5">
                          <div>
                            <FieldLabel>Overlay Text</FieldLabel>
                            <Input value={(event.branding?.overlayText as string) || ''} onChange={v => updateBranding('overlayText', v)} placeholder="Event name or tagline" />
                          </div>
                          <div>
                            <FieldLabel>Footer Text</FieldLabel>
                            <Input value={(event.branding?.footerText as string) || ''} onChange={v => updateBranding('footerText', v)} placeholder="Powered by SnapBooth AI" />
                          </div>
                          <ToggleRow label="Show Date on Photos" desc="Stamps today's date in the footer"
                            checked={(event.branding?.showDate as boolean) ?? false} onChange={v => updateBranding('showDate', v)} />
                          <div>
                            <FieldLabel>Frame / Border Overlay</FieldLabel>
                            <p className="text-zinc-600 text-xs mb-2">Upload a PNG with transparency — placed on top of every photo.</p>
                            <UploadZone label="frame" accept="image/png" currentUrl={(event.branding?.frameUrl as string) || ''}
                              onUploaded={url => updateBranding('frameUrl', url)}
                              uploading={uploadingFrame} setUploading={setUploadingFrame}
                              eventId={event.id} assetType="frame" />
                          </div>
                        </div>
                      </Card>

                      <Card title="Idle Screen Background" subtitle="Video or image shown when booth is waiting" icon={Globe}>
                        <UploadZone label="idle media" accept="image/*,video/*" currentUrl={(event.branding?.idleMediaUrl as string) || ''}
                          onUploaded={url => updateBranding('idleMediaUrl', url)}
                          uploading={uploadingIdle} setUploading={setUploadingIdle}
                          eventId={event.id} assetType="idle" />
                        {(event.branding?.idleMediaUrl as string) && (
                          <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800 max-h-40">
                            {(event.branding.idleMediaUrl as string).match(/\.(mp4|webm|mov)$/i)
                              ? <video src={event.branding.idleMediaUrl as string} muted controls className="w-full max-h-40 object-contain" />
                              // eslint-disable-next-line @next/next/no-img-element
                              : <img src={event.branding.idleMediaUrl as string} alt="Idle preview" className="w-full max-h-40 object-contain" />
                            }
                          </div>
                        )}
                      </Card>

                      <Card title="Photo Template" subtitle="Layout applied to every captured photo" icon={FileText}>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { key: 'classic', label: 'Classic', desc: 'Footer bar', emoji: '🖼️' },
                            { key: 'polaroid', label: 'Polaroid', desc: 'White border', emoji: '📷' },
                            { key: 'strip', label: 'Strip', desc: '4-shot film', emoji: '🎞️' },
                          ].map(t => {
                            const active = ((event.branding?.template as string) || 'classic') === t.key;
                            return (
                              <button key={t.key} onClick={() => updateBranding('template', t.key)}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                                  active ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
                                }`}>
                                <span className="text-2xl">{t.emoji}</span>
                                <span className={`text-xs font-bold ${active ? 'text-violet-300' : 'text-zinc-400'}`}>{t.label}</span>
                                <span className="text-zinc-600 text-[10px]">{t.desc}</span>
                                {active && <span className="text-[9px] text-violet-400 font-bold">ACTIVE</span>}
                              </button>
                            );
                          })}
                        </div>
                      </Card>
                    </div>

                    {/* Live preview */}
                    <div className="xl:sticky xl:top-24 h-fit">
                      <Card title="Live Preview" subtitle="Updates as you type" icon={Eye}>
                        <div className="space-y-4">
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-2">Photo Output</p>
                            {((event.branding?.template as string) || 'classic') === 'polaroid' ? (
                              <div className="rounded-lg overflow-hidden bg-white p-3 shadow-xl border border-zinc-300">
                                <div className="bg-zinc-200 rounded" style={{ aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span className="text-zinc-400 text-sm">📷 Photo</span>
                                </div>
                                <div className="py-3 text-center">
                                  <p className="text-zinc-600 text-sm font-mono">{(event.branding?.footerText as string) || event.name}</p>
                                </div>
                              </div>
                            ) : ((event.branding?.template as string) || 'classic') === 'strip' ? (
                              <div className="flex justify-center">
                                <div className="rounded-xl overflow-hidden" style={{ background: primaryColor, width: '110px' }}>
                                  <div className="px-2 py-2 text-center"><p className="text-white text-[8px] font-black uppercase tracking-widest truncate">{event.name}</p></div>
                                  {[0,1,2,3].map(i => (
                                    <div key={i} className="mx-1.5 mb-1.5 rounded bg-black/30 flex items-center justify-center" style={{ height: '55px' }}>
                                      <span className="text-white/20 text-lg">📷</span>
                                    </div>
                                  ))}
                                  <div className="px-2 pb-2 text-center"><p className="text-white/60 text-[8px]">{new Date().toLocaleDateString()}</p></div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '3/4', background: '#1a1a2e' }}>
                                {(event.branding?.frameUrl as string) && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={event.branding.frameUrl as string} alt="Frame" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-600"><span className="text-5xl">📷</span></div>
                                {(event.branding?.overlayText as string) && (
                                  <div className="absolute top-0 left-0 right-0 bg-black/50 px-4 py-2">
                                    <span className="text-white text-xs font-bold">{event.branding.overlayText as string}</span>
                                  </div>
                                )}
                                {((event.branding?.footerText as string) || (event.branding?.showDate as boolean)) && (
                                  <div className="absolute bottom-0 left-0 right-0 py-2.5 px-4 text-center" style={{ background: `${primaryColor}ee` }}>
                                    {(event.branding?.footerText as string) && <p className="text-white text-xs font-bold">{event.branding.footerText as string}</p>}
                                    {(event.branding?.showDate as boolean) && <p className="text-white/70 text-[10px] mt-0.5">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-2">Idle Screen</p>
                            <div className="rounded-xl overflow-hidden relative" style={{ aspectRatio: '16/9', background: `linear-gradient(135deg, ${primaryColor}40, ${primaryColor}15)` }}>
                              {(event.branding?.idleMediaUrl as string) && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={event.branding.idleMediaUrl as string} alt="" className="absolute inset-0 w-full h-full object-contain" />
                              )}
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3">
                                {(event.branding?.logoUrl as string)
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={event.branding.logoUrl as string} alt="Logo" className="h-8 w-auto object-contain mb-1 drop-shadow-xl" />
                                  : <p className="text-xs font-black text-center drop-shadow">{(event.branding?.eventName as string) || event.name}</p>
                                }
                                <p className="text-[9px] opacity-50 mt-1">TAP TO START</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══ CAPTURE ══ */}
                {tab === 'capture' && (
                  <div className="space-y-5">
                    <Card title="Capture Modes" subtitle="Which experiences guests can use" icon={Clapperboard}>
                      <div className="space-y-5">
                        {[
                          { key: 'allowAI',        icon: Sparkles,   label: 'AI Art Studio',         desc: 'Guests apply AI art transformations — Anime, Cyberpunk, Vintage & more.' },
                          { key: 'allowGIF',       icon: Film,       label: 'Animated GIF',           desc: '6-frame burst GIF, auto-looping and shareable.' },
                          { key: 'allowBoomerang', icon: RotateCcw,  label: 'Boomerang',              desc: 'Ping-pong looping burst video.' },
                          { key: 'allowRetakes',   icon: RefreshCw,  label: 'Allow Retakes',          desc: 'Let guests reshoot before the photo is saved.' },
                        ].map(item => (
                          <ToggleRow key={item.key} icon={item.icon} label={item.label} desc={item.desc}
                            checked={(event.settings?.[item.key] as boolean) ?? true} onChange={v => updateSettings(item.key, v)} />
                        ))}
                      </div>
                    </Card>

                    <Card title="Timing & Sound" subtitle="Countdown behaviour" icon={Clock}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        {[
                          { key: 'countdownSeconds', label: 'Countdown', opts: [1,2,3,5,10], suffix: 's' },
                          { key: 'sessionTimeout',   label: 'Session Timeout', opts: [30,60,90,120,180], suffix: 's' },
                          { key: 'photosPerSession', label: 'Photos / Session', opts: [1,2,3,4], suffix: '' },
                        ].map(s => (
                          <div key={s.key}>
                            <FieldLabel>{s.label}</FieldLabel>
                            <select value={(event.settings?.[s.key] as number) || s.opts[2]}
                              onChange={e => updateSettings(s.key, Number(e.target.value))}
                              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                              {s.opts.map(n => <option key={n} value={n}>{n}{s.suffix}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-4 border-t border-zinc-800 pt-5">
                        <ToggleRow icon={Zap} label="Countdown Sound" desc="Beep on each number + shutter click on capture"
                          checked={(event.settings?.countdownSound as boolean) !== false} onChange={v => updateSettings('countdownSound', v)} />
                        <ToggleRow icon={Camera} label="Roaming Mode" desc="Skip countdown — captures instantly. For photographers on the move."
                          checked={(event.settings?.roamingMode as boolean) ?? false} onChange={v => updateSettings('roamingMode', v)} />
                      </div>
                    </Card>

                    <Card title="Beauty Mode" subtitle="Server-side skin smoothing applied to every photo" icon={Sparkles}>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-300 text-sm font-medium">Smoothing Level</span>
                          <span className="text-violet-300 font-bold text-sm">
                            {(event.settings?.beautyLevel as number) > 0 ? `${event.settings?.beautyLevel}/10` : 'Off'}
                          </span>
                        </div>
                        <input type="range" min="0" max="10" step="1"
                          value={(event.settings?.beautyLevel as number) || 0}
                          onChange={e => updateSettings('beautyLevel', Number(e.target.value))}
                          className="w-full accent-violet-500" />
                        <div className="flex justify-between text-zinc-600 text-xs mt-1">
                          <span>Off</span><span>Subtle</span><span>Medium</span><span>Strong</span>
                        </div>
                      </div>
                    </Card>

                    <Card title="Security" subtitle="Operator PIN and booth locking" icon={ShieldCheck}>
                      <div className="space-y-5">
                        <div>
                          <FieldLabel>Operator PIN</FieldLabel>
                          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8}
                            value={(event.settings?.operatorPin as string) || ''}
                            onChange={e => updateSettings('operatorPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="No PIN — tap gear icon freely"
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-violet-500 transition-colors max-w-xs" />
                          <p className="text-zinc-600 text-xs mt-1.5">4–8 digits. Tap ⚙️ in booth to access operator controls.</p>
                        </div>
                        <div className="border-t border-zinc-800 pt-4 space-y-4">
  
                          <ToggleRow icon={Users} label="Lead Capture" desc="Ask guests for their email before seeing their photo"
                            checked={(event.settings?.leadCapture as boolean) ?? false} onChange={v => updateSettings('leadCapture', v)} />
                          {(event.settings?.leadCapture as boolean) && (
                            <div className="pl-12 border-l-2 border-violet-500/30 ml-4">
                              <ToggleRow label="Make Email Required" desc="Removes the Skip option"
                                checked={(event.settings?.leadRequired as boolean) ?? false} onChange={v => updateSettings('leadRequired', v)} />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card title="Booth Limits" subtitle="Time gates and photo caps" icon={Activity}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><FieldLabel>Opens At</FieldLabel>
                          <input type="datetime-local" value={(event.settings?.boothStart as string) || ''}
                            onChange={e => updateSettings('boothStart', e.target.value || null)}
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" /></div>
                        <div><FieldLabel>Closes At</FieldLabel>
                          <input type="datetime-local" value={(event.settings?.boothEnd as string) || ''}
                            onChange={e => updateSettings('boothEnd', e.target.value || null)}
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" /></div>
                        <div><FieldLabel>Max Photos</FieldLabel>
                          <Input value={String((event.settings?.photoLimit as number) || '')} onChange={v => updateSettings('photoLimit', v ? Number(v) : null)} placeholder="Unlimited" /></div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* ══ SHARING ══ */}
                {tab === 'sharing' && (
                  <div className="space-y-5">
                    <Card title="Share Channels" subtitle="Which options guests see on the share screen" icon={Share2}>
                      <div className="space-y-5">
                        {[
                          { key: 'allowEmailShare', icon: Mail,           label: 'Email',     desc: 'Send photo to guest email. Requires RESEND_API_KEY on Render.', default: true },
                          { key: 'allowSMSShare',   icon: MessageSquare,  label: 'SMS',       desc: 'Send via SMS. Requires Twilio env vars on Render.', default: false },
                          { key: 'allowWhatsApp',   icon: MessageSquare,  label: 'WhatsApp',  desc: 'Open WhatsApp share. Works on all mobile devices.', default: true },
                          { key: 'allowInstagram',  icon: Share2,         label: 'Instagram', desc: 'Copy link optimised for Instagram Stories.', default: true },
                          { key: 'allowAirDrop',    icon: Wifi,           label: 'AirDrop',   desc: 'iOS/macOS native share. Apple devices only.', default: true },
                        ].map(item => (
                          <ToggleRow key={item.key} icon={item.icon} label={item.label} desc={item.desc}
                            checked={(event.settings?.[item.key] as boolean) ?? item.default} onChange={v => updateSettings(item.key, v)} />
                        ))}
                      </div>
                    </Card>

                    <Card title="Share Screen Behaviour" icon={Clock}>
                      <div className="space-y-5">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <FieldLabel>Auto-advance Timeout</FieldLabel>
                            <span className="text-violet-300 font-bold text-sm">
                              {(event.settings?.shareScreenTimeout as number) > 0 ? `${event.settings?.shareScreenTimeout}s` : 'Off'}
                            </span>
                          </div>
                          <input type="range" min="0" max="120" step="5"
                            value={(event.settings?.shareScreenTimeout as number) || 0}
                            onChange={e => updateSettings('shareScreenTimeout', Number(e.target.value))}
                            className="w-full accent-violet-500" />
                          <p className="text-zinc-600 text-xs mt-1.5">Share screen advances to next guest automatically. 0 = wait forever.</p>
                        </div>
                        <div><FieldLabel>WhatsApp Country Code</FieldLabel>
                          <Input value={(event.settings?.whatsappCountryCode as string) || ''} onChange={v => updateSettings('whatsappCountryCode', v)} placeholder="91 for India, 1 for US" /></div>
                      </div>
                    </Card>

                    <Card title="Email Customisation" icon={Mail}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div><FieldLabel>From Name</FieldLabel>
                          <Input value={(event.settings?.emailFromName as string) || ''} onChange={v => updateSettings('emailFromName', v)} placeholder={event.name} /></div>
                        <div><FieldLabel>Reply-To</FieldLabel>
                          <Input value={(event.settings?.emailReplyTo as string) || ''} onChange={v => updateSettings('emailReplyTo', v)} placeholder="you@yourdomain.com" type="email" /></div>
                      </div>
                      <div className="mb-4"><FieldLabel>Email Subject</FieldLabel>
                        <Input value={(event.settings?.emailSubject as string) || ''} onChange={v => updateSettings('emailSubject', v)} placeholder={`Your photo from ${event.name} 📸`} /></div>
                      <div className="mb-4"><FieldLabel>SMS Message</FieldLabel>
                        <textarea value={(event.settings?.smsMessage as string) || ''}
                          onChange={e => updateSettings('smsMessage', e.target.value)} rows={2}
                          placeholder={`📸 ${event.name} — here's your photo! {url}`}
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none" />
                        <p className="text-zinc-600 text-xs mt-1">Use {'{url}'} for photo link, {'{event}'} for event name</p>
                      </div>
                      <div className="border-t border-zinc-800 pt-4">
                        <FieldLabel>Send Test Email</FieldLabel>
                        <TestEmailButton eventId={event.id} />
                      </div>
                    </Card>

                    <Card title="Webhook / Zapier" subtitle="POST to your URL on every photo capture" icon={Zap}>
                      <div className="space-y-4">
                        <div><FieldLabel>Webhook URL</FieldLabel>
                          <Input value={(event.settings?.webhookUrl as string) || ''} onChange={v => updateSettings('webhookUrl', v)} placeholder="https://hooks.zapier.com/hooks/catch/..." /></div>
                        <div><FieldLabel>Secret (optional)</FieldLabel>
                          <Input value={(event.settings?.webhookSecret as string) || ''} onChange={v => updateSettings('webhookSecret', v)} placeholder="Sent as X-SnapBooth-Secret header" /></div>
                        <div className="flex items-center gap-3">
                          <button disabled={webhookTesting || !(event.settings?.webhookUrl as string)}
                            onClick={async () => {
                              if (!(event.settings?.webhookUrl as string)) return;
                              setWebhookTesting(true); setWebhookResult(null);
                              try {
                                const r = await testWebhook(event.id, event.settings.webhookUrl as string);
                                setWebhookResult(r.ok ? 'ok' : 'fail');
                                toast[r.ok ? 'success' : 'error'](r.ok ? 'Webhook delivered!' : `Failed: ${r.error || 'HTTP error'}`);
                              } catch { setWebhookResult('fail'); toast.error('Webhook test failed'); }
                              finally { setWebhookTesting(false); }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-40">
                            {webhookTesting ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                            {webhookTesting ? 'Testing...' : 'Send Test Event'}
                          </button>
                          {webhookResult === 'ok' && <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Delivered</span>}
                          {webhookResult === 'fail' && <span className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Failed — check URL</span>}
                        </div>
                        <div className="bg-zinc-950 rounded-xl p-3 font-mono text-[11px] text-zinc-500 leading-relaxed border border-zinc-800">
                          {`{ "event": "photo.taken", "photoId": "...", "photoUrl": "...", "mode": "single" }`}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* ══ PRINT ══ */}
                {tab === 'print' && (
                  <div className="space-y-5">
                    <Card title="Printer Connection" subtitle="SnapBooth uses AirPrint — any compatible printer on the same WiFi" icon={Printer}>
                      <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 mb-4">
                        <p className="text-emerald-300 text-sm font-semibold">Your Epson PM-520 is AirPrint compatible</p>
                        <p className="text-emerald-200/50 text-xs mt-1 leading-relaxed">Keep the printer on the same WiFi as your iPad. When guests tap Print, the AirPrint picker appears automatically.</p>
                      </div>
                      <p className="text-zinc-500 text-sm">To verify: go to Diagnostics → Send Test Page. If the print picker appears, the printer is connected.</p>
                    </Card>

                    <Card title="Paper Size" subtitle="Select the paper loaded in your printer" icon={FileText}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { key: '4x6', label: '4×6"', desc: 'Standard photo', rec: true },
                          { key: '5x7', label: '5×7"', desc: 'Large photo' },
                          { key: 'a5',  label: 'A5',   desc: '148×210mm' },
                          { key: 'a4',  label: 'A4',   desc: '210×297mm' },
                        ].map(size => (
                          <button key={size.key} onClick={() => updateSettings('paperSize', size.key)}
                            className={`flex flex-col items-center p-3 rounded-xl border-2 text-sm transition-all ${
                              ((event.settings?.paperSize as string) || '4x6') === size.key
                                ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'
                            }`}>
                            <span className="font-bold text-base">{size.label}</span>
                            <span className="text-xs opacity-60 mt-0.5">{size.desc}</span>
                            {size.rec && <span className="text-[9px] text-emerald-400 mt-1">Recommended</span>}
                          </button>
                        ))}
                      </div>
                    </Card>

                    <Card title="Print Settings" icon={Printer}>
                      <div className="space-y-6">
                        <div>
                          <FieldLabel>Copies Per Guest</FieldLabel>
                          <div className="flex gap-2 mt-1">
                            {[1,2,3,4].map(n => (
                              <button key={n} onClick={() => updateSettings('printCopies', n)}
                                className={`w-12 h-12 rounded-xl font-bold text-lg transition-all border-2 ${
                                  ((event.settings?.printCopies as number) || 1) === n
                                    ? 'border-violet-500 bg-violet-600 text-white'
                                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                                }`}>{n}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <FieldLabel>Max Prints Per Event</FieldLabel>
                          <Input value={String((event.settings?.maxPrints as number) || '')} onChange={v => updateSettings('maxPrints', v ? Number(v) : null)} placeholder="Unlimited" />
                          <p className="text-zinc-600 text-xs mt-1.5">Booth shows a message when the limit is reached.</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <FieldLabel>Print Scale</FieldLabel>
                            <span className="text-violet-300 font-bold text-sm">{(event.settings?.printScale as number) || 98}%</span>
                          </div>
                          <input type="range" min="80" max="100" step="1"
                            value={(event.settings?.printScale as number) || 98}
                            onChange={e => updateSettings('printScale', Number(e.target.value))}
                            className="w-full accent-violet-500" />
                          <p className="text-zinc-600 text-xs mt-1.5">Reduce if photo is cropped at edges. 98% recommended for Epson PM-520.</p>
                        </div>
                        <div className="border-t border-zinc-800 pt-5">
                          <ToggleRow icon={Zap} label="Auto-Print" desc="Sends photo to printer automatically after every capture — no guest tap needed"
                            checked={(event.settings?.autoPrint as boolean) ?? false} onChange={v => updateSettings('autoPrint', v)} />
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* ══ PHOTOS ══ */}
                {tab === 'photos' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-zinc-900/40 border border-white/[0.04] rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-zinc-300 text-sm font-medium">{visiblePhotos.length} photos</span>
                      </div>
                      <button onClick={handleZip} disabled={zipLoading || visiblePhotos.length === 0}
                        className="flex items-center gap-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-40">
                        <Download className="w-3.5 h-3.5" /> {zipLoading ? 'Preparing...' : 'Download All'}
                      </button>
                    </div>
                    {visiblePhotos.length === 0 ? (
                      <div className="text-center py-24 bg-zinc-900/20 border border-white/[0.03] rounded-2xl border-dashed">
                        <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                        <p className="text-zinc-500 text-lg font-medium">No photos yet</p>
                        <p className="text-zinc-600 text-sm mt-1">Photos will appear here as guests use the booth</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {visiblePhotos.map(photo => (
                          <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/[0.04] bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.thumb_url || photo.url} alt="capture" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-2 backdrop-blur-sm">
                              <a href={photo.url} target="_blank" rel="noreferrer"
                                className="bg-white/10 hover:bg-white/20 text-white text-xs w-full py-1.5 rounded-lg text-center transition-colors">View HD</a>
                              <button onClick={() => handleDeletePhoto(photo.id)} disabled={deletingId === photo.id}
                                className="bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs w-full py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                {deletingId === photo.id ? '...' : 'Delete'}
                              </button>
                            </div>
                            <div className="absolute top-1.5 left-1.5 text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded-md">{photo.mode}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ══ MODERATION ══ */}
                {tab === 'moderation' && (
                  <div className="space-y-4">
                    <Card title="Hidden Photos" subtitle="These are hidden from the public gallery" icon={EyeOff}>
                      {hiddenPhotos.length === 0 ? (
                        <div className="text-center py-12">
                          <Eye className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                          <p className="text-zinc-500 text-sm">No hidden photos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {hiddenPhotos.map(photo => (
                            <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/[0.04] bg-zinc-900">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photo.thumb_url || photo.url} alt="hidden" className="w-full h-full object-cover opacity-50" loading="lazy" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-2">
                                <button onClick={() => handleToggleHide(photo)} disabled={moderatingId === photo.id}
                                  className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-xs w-full py-1.5 rounded-lg transition-colors">
                                  {moderatingId === photo.id ? '...' : 'Restore'}
                                </button>
                                <button onClick={() => handleDeletePhoto(photo.id)} disabled={deletingId === photo.id}
                                  className="bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs w-full py-1.5 rounded-lg transition-colors">
                                  {deletingId === photo.id ? '...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                    <Card title="Visible Photos" subtitle="Tap any photo to hide it from the public gallery" icon={Eye}>
                      {visiblePhotos.length === 0 ? (
                        <p className="text-zinc-600 text-sm text-center py-8">No visible photos</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {visiblePhotos.map(photo => (
                            <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/[0.04] bg-zinc-900 cursor-pointer" onClick={() => handleToggleHide(photo)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photo.thumb_url || photo.url} alt="photo" className="w-full h-full object-cover" loading="lazy" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                <div className="flex items-center gap-1 bg-black/70 px-3 py-1.5 rounded-lg">
                                  <EyeOff className="w-3.5 h-3.5 text-white" />
                                  <span className="text-white text-xs font-medium">Hide</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* ══ LEADS ══ */}
                {tab === 'leads' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-white font-semibold">Lead Capture</h2>
                        <p className="text-zinc-500 text-sm mt-0.5">{leads.length} emails collected</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleLoadLeads} disabled={leadsLoading}
                          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg transition-colors">
                          <RefreshCw className={`w-3.5 h-3.5 ${leadsLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        {leads.length > 0 && (
                          <button onClick={() => { exportLeadsCSV(leads, event.name); toast.success(`Exported ${leads.length} leads`); }}
                            className="flex items-center gap-1.5 text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 px-3 py-2 rounded-lg transition-colors font-semibold">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                          </button>
                        )}
                      </div>
                    </div>
                    {leads.length === 0 ? (
                      <Card title="No leads yet" icon={Users}>
                        <div className="text-center py-8">
                          <p className="text-zinc-500 text-sm">Enable Lead Capture in Capture settings to collect emails from guests.</p>
                        </div>
                      </Card>
                    ) : (
                      <Card title={`${leads.length} Leads`} icon={Users}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-zinc-800">
                              <th className="text-zinc-500 text-left pb-3 font-medium text-xs uppercase tracking-wider">Email</th>
                              <th className="text-zinc-500 text-left pb-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Name</th>
                              <th className="text-zinc-500 text-left pb-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                              <th className="text-zinc-500 text-left pb-3 font-medium text-xs uppercase tracking-wider">Consent</th>
                            </tr></thead>
                            <tbody>
                              {leads.map(lead => (
                                <tr key={lead.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                                  <td className="py-3 text-zinc-200">{lead.email || '—'}</td>
                                  <td className="py-3 text-zinc-400 hidden sm:table-cell">{lead.name || '—'}</td>
                                  <td className="py-3 text-zinc-500 hidden md:table-cell text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                                  <td className="py-3">
                                    {lead.consented
                                      ? <span className="text-emerald-400 flex items-center gap-1 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Yes</span>
                                      : <span className="text-zinc-600 flex items-center gap-1 text-xs"><XCircle className="w-3.5 h-3.5" /> No</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* ══ ANALYTICS ══ */}
                {tab === 'analytics' && (
                  <div className="space-y-5">
                    {stats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { v: stats.totalPhotos,     l: 'Photos',    c: '#7c3aed' },
                          { v: (stats.totalGIFs || 0) + (stats.totalBoomerangs || 0), l: 'GIFs', c: '#0ea5e9' },
                          { v: stats.totalAIGenerated, l: 'AI Art',   c: '#f59e0b' },
                          { v: stats.totalShares,      l: 'Shares',   c: '#10b981' },
                          { v: stats.totalPrints,      l: 'Prints',   c: '#6366f1' },
                          { v: stats.totalSessions,    l: 'Sessions', c: '#ec4899' },
                        ].map(s => (
                          <div key={s.l} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                            <div className="text-2xl font-black mb-0.5" style={{ color: s.c }}>{s.v ?? 0}</div>
                            <div className="text-zinc-500 text-xs uppercase tracking-wide">{s.l}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Card title="Live — Right Now" icon={Activity}>
                      <LiveDashboard eventId={event.id} />
                    </Card>
                    <AnalyticsDashboard eventId={event.id} />
                    <button onClick={async () => {
                      try {
                        const data = await getEventAnalytics(event.id, 90);
                        const rows = (data.daily || []).map((d: Record<string, unknown>) => ({ date: d.date, photos: d.photos, gifs: d.gifs, ai: d.ai }));
                        exportAnalyticsCSV(rows, event.name);
                        toast.success('Exported!');
                      } catch { toast.error('Export failed'); }
                    }} className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Export Analytics CSV
                    </button>
                  </div>
                )}

                {/* ══ DIAGNOSTICS ══ */}
                {tab === 'diagnostics' && <DiagnosticsPanel eventId={event.id} />}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Unsaved Changes Bar ── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)]"
            style={{ width: 'min(520px, calc(100vw - 32px))' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">Unsaved changes</p>
                <p className="text-zinc-400 text-xs">Save to update the live booth</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-white/[0.08] pl-6 flex-shrink-0">
              <button onClick={() => setIsDirty(false)} className="px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                Discard
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
