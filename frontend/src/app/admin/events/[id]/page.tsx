'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Palette, Camera, Share2, Printer, Image as ImageIcon, 
  ShieldCheck, Users, BarChart3, Activity, UploadCloud, Check, X, 
  ChevronLeft, Copy, ExternalLink, Save, RefreshCw, Trash2, Eye, EyeOff, 
  Download, Play, Smartphone, Mail, MessageCircle, Instagram, Wifi,
  AlertCircle, Settings, Clapperboard, Sparkles, Film, RotateCcw,
  MonitorPlay, Type, ImagePlus, Clock, Zap, Link as LinkIcon, HardDrive,
  Cpu, Video, BoxSelect, SlidersHorizontal, UserCheck
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
  branding: Record<string, unknown>; settings: Record<string, unknown>;
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
interface PrintJob { id: string; status: string; time: string; name: string; }

// ── Components ─────────────────────────────────────────────────────────────

function PremiumToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SectionCard({ title, icon: Icon, description, children }: { title: string; icon: any; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-6 py-5 border-b border-white/[0.04] bg-white/[0.01]">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-violet-400" /> {title}
        </h3>
        {description && <p className="text-zinc-400 text-sm mt-1">{description}</p>}
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );
}

async function uploadAssetViaBackend(file: File, eventId: string, type: 'logo' | 'frame' | 'idle'): Promise<string> {
  const token = localStorage.getItem('sb_access_token');
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData(); formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/events/${eventId}/upload-asset?type=${type}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
  return (await res.json()).url;
}

function UploadButton({ label, accept, currentUrl, onUploaded, uploading, setUploading, storagePath }: {
  label: string; accept: string; currentUrl: string; onUploaded: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void; storagePath: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pathParts = storagePath.split('/');
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAssetViaBackend(file, pathParts[1], pathParts[2] as 'logo' | 'frame' | 'idle');
      onUploaded(url); toast.success(`${label} uploaded!`);
    } catch (err: any) { toast.error(err.message || 'Upload failed'); } 
    finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  }

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <div onClick={() => !uploading && ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${uploading ? 'border-zinc-700 bg-zinc-900/50 opacity-50' : 'border-zinc-700 hover:border-violet-500 hover:bg-violet-500/5 bg-zinc-900/50'}`}>
        <UploadCloud className={`w-6 h-6 ${uploading ? 'text-zinc-500 animate-bounce' : 'text-violet-400'}`} />
        <span className="text-sm font-medium text-zinc-300">{uploading ? 'Uploading...' : `Click to upload ${label}`}</span>
      </div>
      {currentUrl && (
        <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
          <p className="text-zinc-400 text-xs truncate max-w-[200px]">{currentUrl.split('/').pop()}</p>
          <button onClick={() => onUploaded('')} className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
        </div>
      )}
    </div>
  );
}

function TestEmailButton({ eventId }: { eventId: string }) {
  const[email, setEmail] = useState(''); const [sending, setSending] = useState(false);
  async function sendTest() {
    if (!email.trim()) return; setSending(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${API_BASE}/api/share/test-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ toEmail: email.trim(), eventId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success(`Test email sent to ${email}!`); setEmail('');
    } catch (err: any) { toast.error(err.message || 'Failed'); } finally { setSending(false); }
  }
  return (
    <div className="pt-4 border-t border-white/[0.04]">
      <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Send Test Email</label>
      <div className="flex gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
          className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
        <button onClick={sendTest} disabled={!email.trim() || sending}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex-shrink-0">
          {sending ? 'Sending...' : 'Test'}
        </button>
      </div>
    </div>
  );
}

function DiagnosticsPanel({ eventId }: { eventId: string }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const[latency, setLatency] = useState<number | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [cameraLabel, setCameraLabel] = useState('Not tested');
  const [testingCamera, setTestingCamera] = useState(false);
  const[aiStatus, setAiStatus] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchAiStatus = useCallback(async () => {
    setAiLoading(true);
    try { const res = await fetch(`${API_BASE}/api/ai/status`); if (res.ok) setAiStatus(await res.json()); } catch {} finally { setAiLoading(false); }
  },[]);
  const runPing = useCallback(async () => {
    const r = await pingBackend(); setBackendOk(r.ok); setLatency(r.latencyMs);
  },[]);

  useEffect(() => {
    const up = () => setOnline(true); const dn = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', dn);
    fetchAiStatus(); runPing();
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, [fetchAiStatus, runPing]);

  async function handleCameraTest() {
    setTestingCamera(true); setCameraOk(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      await new Promise(r => setTimeout(r, 1000));
      stream.getTracks().forEach(t => t.stop());
      setCameraOk(true); setCameraLabel(stream.getVideoTracks()[0]?.label || 'Camera OK');
    } catch (e: any) { setCameraOk(false); setCameraLabel(e.message || 'Camera access denied'); } finally { setTestingCamera(false); }
  }

  const StatusRow = ({ label, ok, value, sub }: any) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <div>
        <p className="text-zinc-200 text-sm font-medium">{label}</p>
        {sub && <p className="text-zinc-500 text-xs mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-xs text-right">{value}</span>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok === null ? 'bg-zinc-600 animate-pulse' : ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SectionCard title="System Status" icon={Activity}>
        <StatusRow label="Network" ok={online} value={online ? 'Online' : 'Offline'} />
        <StatusRow label="Backend API" ok={backendOk} value={backendOk === null ? 'Checking...' : backendOk ? 'Connected' : 'Unreachable'} sub={latency !== null ? `${latency}ms latency` : undefined} />
        <StatusRow label="Socket.IO" ok={backendOk} value={backendOk ? 'Active' : 'Disconnected'} sub="Live photo push" />
      </SectionCard>

      <SectionCard title="AI Generation Tiers" icon={Cpu}>
        {aiStatus ? (
          <>
            <div className="flex items-center gap-3 p-4 rounded-xl mb-4 bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-emerald-100 font-bold text-sm">{aiStatus.activeTierLabel}</p>
                <p className="text-emerald-400/60 text-xs mt-0.5">Active generation model</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(aiStatus.tiers).map(([key, tier]: any) => (
                <div key={key} className={`flex items-center justify-between py-2.5 px-3 rounded-lg border ${aiStatus.activeTier === key ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-300 text-xs font-semibold">{key.toUpperCase()}</p>
                    <p className="text-zinc-500 text-[10px] truncate">{tier.model}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${tier.status === 'active' || tier.status === 'configured' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {tier.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-zinc-500 text-sm">Loading AI status...</p>}
      </SectionCard>

      <SectionCard title="Camera Bridge" icon={Video}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-zinc-400 text-sm">Test browser webcam access.</p>
          <button onClick={handleCameraTest} disabled={testingCamera} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-all">
            {testingCamera ? 'Testing...' : 'Verify Shutter'}
          </button>
        </div>
        <StatusRow label="Camera Access" ok={cameraOk} value={cameraLabel} />
        <video ref={videoRef} className="hidden" muted playsInline />
      </SectionCard>

      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2"><Activity className="w-4 h-4" /> System Reset</h3>
        <p className="text-red-400/60 text-sm mb-4">Clears all active streams and reloads the booth.</p>
        <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm border border-red-500/20 transition-all">
          One-Tap System Reset
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function EventManagePage() {
  const params = useParams(); const router = useRouter(); const eventId = params.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const[loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const[isDirty, setIsDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  
  const [zipLoading, setZipLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const[leadsLoading, setLeadsLoading] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<'ok' | 'fail' | null>(null);

  const [upLogo, setUpLogo] = useState(false);
  const[upIdle, setUpIdle] = useState(false);
  const [upFrame, setUpFrame] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const[ev, st, ph] = await Promise.all([ getEvent(eventId), getEventStats(eventId), getEventPhotosWithHidden(eventId) ]);
        setEvent(ev); setStats(st); setPhotos(ph.photos ||[]);
      } catch { toast.error('Event not found'); router.push('/admin'); } 
      finally { setLoading(false); }
    } load();
  }, [eventId, router]);

  async function handleSave() {
    if (!event) return; setSaving(true);
    try {
      await updateEvent(event.id, { name: event.name, venue: event.venue, date: event.date, branding: event.branding, settings: event.settings });
      setIsDirty(false); toast.success('Changes saved successfully');
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  }

  function updateBranding(key: string, value: unknown) { setEvent(e => e ? { ...e, branding: { ...e.branding, [key]: value } } : e); setIsDirty(true); }
  function updateSettings(key: string, value: unknown) { setEvent(e => e ? { ...e, settings: { ...e.settings, [key]: value } } : e); setIsDirty(true); }

  const boothUrl = event ? `${typeof window !== 'undefined' ? window.location.origin : ''}/booth?event=${event.slug}` : '';
  const primaryColor = (event?.branding?.primaryColor as string) || '#7c3aed';

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
  if (!event) return null;

  const visiblePhotos = photos.filter(p => !p.is_hidden);
  const hiddenPhotos = photos.filter(p => p.is_hidden);

  const NAV: { section: string; icon: React.ElementType; tabs: { key: Tab; label: string; badge?: number }[] }[] = [
    { section: 'Event', icon: LayoutDashboard, tabs:[{ key: 'overview', label: 'Overview & Access' }] },
    { section: 'Design', icon: Palette, tabs: [{ key: 'branding', label: 'Branding & UI' }] },
    { section: 'Booth', icon: Camera, tabs: [{ key: 'capture', label: 'Capture & Limits' }] },
    { section: 'Share', icon: Share2, tabs: [{ key: 'sharing', label: 'Sharing & Webhooks' }] },
    { section: 'Print', icon: Printer, tabs:[{ key: 'print', label: 'AirPrint Setup' }] },
    { section: 'Content', icon: ImageIcon, tabs:[
        { key: 'photos', label: 'Gallery', badge: visiblePhotos.length },
        { key: 'moderation', label: 'Moderation', badge: hiddenPhotos.length },
        { key: 'leads', label: 'Leads CSV', badge: leads.length }
    ]},
    { section: 'Insights', icon: BarChart3, tabs:[
        { key: 'analytics', label: 'Analytics' },
        { key: 'diagnostics', label: 'Diagnostics' }
    ]},
  ];

  return (
    <div className="min-h-screen bg-[#09090b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(124,58,237,0.1),rgba(255,255,255,0))] text-zinc-50 flex flex-col font-sans selection:bg-violet-500/30">
      
      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-white/5">
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-6 bg-white/[0.08]" />
            <h1 className="font-bold text-lg tracking-tight truncate">{event.name}</h1>
            <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${event.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${event.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />{event.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('URL Copied'); }} className="hidden sm:flex items-center gap-2 text-xs bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 px-3 py-2 rounded-lg transition-colors text-zinc-300">
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </button>
            <Link href={`/booth?event=${event.slug}`} target="_blank" className="flex items-center gap-2 text-xs bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-lg transition-colors font-semibold">
              Launch Kiosk <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden max-w-[1600px] w-full mx-auto">
        <aside className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-white/[0.04] py-6 px-4 overflow-y-auto scrollbar-none">
          <nav className="space-y-6">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-2"><group.icon className="w-3.5 h-3.5" /> {group.section}</p>
                <div className="space-y-1">
                  {group.tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${tab === t.key ? 'bg-violet-500/10 text-violet-300 font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
                      <span>{t.label}</span>
                      {t.badge !== undefined && t.badge > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tab === t.key ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'}`}>{t.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Nav */}
        <div className="md:hidden fixed bottom-0 w-full z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-white/[0.05] p-2 flex overflow-x-auto gap-2">
           {NAV.flatMap(g => g.tabs).map(t => (
             <button key={t.key} onClick={() => setTab(t.key)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium ${tab === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 bg-zinc-900'}`}>{t.label}</button>
           ))}
        </div>

        <main className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-8">
                
                {/* ══ OVERVIEW ══ */}
                {tab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="Event Details" icon={LayoutDashboard}>
                      <div className="space-y-4">
                        <div>
                          <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Name</label>
                          <input value={event.name} onChange={e => { setEvent({ ...event, name: e.target.value }); setIsDirty(true); }} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Venue</label>
                          <input value={event.venue || ''} onChange={e => { setEvent({ ...event, venue: e.target.value }); setIsDirty(true); }} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Date</label>
                          <input type="date" value={event.date?.split('T')[0] || ''} onChange={e => { setEvent({ ...event, date: e.target.value }); setIsDirty(true); }} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 block" />
                        </div>
                      </div>
                    </SectionCard>
                    <SectionCard title="Kiosk Access" icon={Smartphone} description="Share this with your operator.">
                       <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between mb-4">
                        <code className="text-violet-300 text-sm truncate">{boothUrl}</code>
                      </div>
                      <Link href={`/booth?event=${event.slug}`} target="_blank" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors shadow-lg shadow-violet-500/20">
                        Launch Web Booth <ExternalLink className="w-4 h-4" />
                      </Link>
                    </SectionCard>
                  </div>
                )}

                {/* ══ BRANDING ══ */}
                {tab === 'branding' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <div className="space-y-6">
                      <SectionCard title="Identity" icon={Palette}>
                        <div className="space-y-5">
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Brand Color</label>
                            <div className="flex gap-3 items-center">
                              <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test((event.branding?.primaryColor as string) || '') ? (event.branding.primaryColor as string) : '#7c3aed'} onChange={e => updateBranding('primaryColor', e.target.value)} className="w-14 h-12 rounded-xl border border-zinc-700 bg-zinc-900 cursor-pointer p-1" />
                              <input value={(event.branding?.primaryColor as string) || ''} onChange={e => updateBranding('primaryColor', e.target.value)} placeholder="Hex code (e.g. #7c3aed)" className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                          </div>
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Event Name (Idle Screen)</label>
                            <input value={(event.branding?.eventName as string) || ''} onChange={e => updateBranding('eventName', e.target.value)} placeholder={`Default: ${event.name}`} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
                          </div>
                          <UploadButton label="Logo" accept="image/*" currentUrl={(event.branding?.logoUrl as string) || ''} onUploaded={url => updateBranding('logoUrl', url)} uploading={upLogo} setUploading={setUpLogo} storagePath={`branding/${event.id}/logo`} />
                        </div>
                      </SectionCard>

                      <SectionCard title="Photo Overlays" icon={ImagePlus}>
                         <div className="space-y-5">
                           <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Photo Template</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { key: 'classic', label: 'Classic' }, { key: 'polaroid', label: 'Polaroid' }, { key: 'strip', label: 'Film Strip' }
                              ].map(t => {
                                const active = ((event.branding?.template as string) || 'classic') === t.key;
                                return (
                                  <button key={t.key} onClick={() => updateBranding('template', t.key)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${active ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600'}`}>{t.label}</button>
                                );
                              })}
                            </div>
                           </div>
                           <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Footer Text</label>
                            <input value={(event.branding?.footerText as string) || ''} onChange={e => updateBranding('footerText', e.target.value)} placeholder="e.g. Sarah & John's Wedding" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
                           </div>
                           <UploadButton label="PNG Frame Overlay" accept="image/png" currentUrl={(event.branding?.frameUrl as string) || ''} onUploaded={url => updateBranding('frameUrl', url)} uploading={upFrame} setUploading={setUpFrame} storagePath={`branding/${event.id}/frame`} />
                         </div>
                      </SectionCard>

                      <SectionCard title="Idle Background" icon={MonitorPlay}>
                        <UploadButton label="Idle Video/Image" accept="video/mp4,image/*" currentUrl={(event.branding?.idleMediaUrl as string) || ''} onUploaded={url => updateBranding('idleMediaUrl', url)} uploading={upIdle} setUploading={setUpIdle} storagePath={`branding/${event.id}/idle`} />
                      </SectionCard>
                    </div>

                    {/* Live Preview Sticky Sidebar */}
                    <div className="xl:sticky xl:top-24 space-y-6">
                       <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-6 shadow-2xl">
                          <h3 className="text-white font-medium mb-4 flex items-center gap-2"><Eye className="w-4 h-4 text-zinc-400" /> Live Output Preview</h3>
                          
                          <div className="rounded-xl overflow-hidden relative bg-zinc-950 border border-zinc-800" style={{ aspectRatio: '3/4' }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700"><Camera className="w-10 h-10 mb-2" /><span className="text-xs">Guest Photo</span></div>
                            {(event.branding?.frameUrl as string) && <img src={event.branding.frameUrl as string} alt="Frame" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
                            {((event.branding?.footerText as string)) && (
                              <div className="absolute bottom-0 left-0 right-0 py-3 px-4 text-center backdrop-blur-md" style={{ background: `${primaryColor}e6` }}>
                                <p className="text-white text-sm font-bold shadow-sm">{event.branding.footerText as string}</p>
                              </div>
                            )}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {/* ══ CAPTURE ══ */}
                {tab === 'capture' && (
                  <div className="space-y-6">
                    <SectionCard title="Capture Experiences" icon={Clapperboard}>
                      <div className="space-y-6">
                        {[
                          { key: 'allowAI', icon: Sparkles, label: 'AI Transformations', desc: 'Guests apply AI art styles after taking a photo.' },
                          { key: 'allowGIF', icon: Film, label: 'Animated GIF', desc: 'Creates a looping GIF from 6 burst frames.' },
                          { key: 'allowBoomerang', icon: RotateCcw, label: 'Boomerang', desc: 'Ping-pong looping burst video.' },
                          { key: 'allowRetakes', icon: RefreshCw, label: 'Allow Retakes', desc: 'Let guests reshoot before accepting the photo.' },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between group">
                            <div className="flex gap-4 items-center">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-violet-500/50 transition-colors">
                                <item.icon className="w-5 h-5 text-zinc-300 group-hover:text-violet-400" />
                              </div>
                              <div>
                                <p className="text-zinc-200 text-sm font-medium">{item.label}</p>
                                <p className="text-zinc-500 text-xs mt-0.5">{item.desc}</p>
                              </div>
                            </div>
                            <PremiumToggle checked={(event.settings?.[item.key] as boolean) ?? true} onChange={v => updateSettings(item.key, v)} />
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SectionCard title="Timing & Sound" icon={Clock}>
                        <div className="space-y-4">
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Countdown (Seconds)</label>
                            <select value={(event.settings?.countdownSeconds as number) || 3} onChange={e => updateSettings('countdownSeconds', Number(e.target.value))} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 appearance-none">
                              {[1,2,3,5,10].map(n => <option key={n} value={n}>{n} Seconds</option>)}
                            </select>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <div><p className="text-zinc-200 text-sm font-medium">Countdown Beep</p><p className="text-zinc-500 text-xs mt-0.5">Play audio during capture</p></div>
                            <PremiumToggle checked={(event.settings?.countdownSound as boolean) ?? true} onChange={v => updateSettings('countdownSound', v)} />
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="Security & Kiosk" icon={ShieldCheck}>
                        <div className="space-y-6">
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Operator PIN</label>
                            <input type="text" inputMode="numeric" maxLength={8} value={(event.settings?.operatorPin as string) || ''} onChange={e => updateSettings('operatorPin', e.target.value.replace(/\D/g, ''))} placeholder="Leave blank for none" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-lg tracking-[0.5em] font-mono focus:outline-none focus:border-violet-500" />
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <div><p className="text-zinc-200 text-sm font-medium">Kiosk Lock</p><p className="text-zinc-500 text-xs mt-0.5">Prevent closing the booth</p></div>
                            <PremiumToggle checked={(event.settings?.kioskMode as boolean) ?? false} onChange={v => updateSettings('kioskMode', v)} />
                          </div>
                        </div>
                      </SectionCard>
                    </div>

                    <SectionCard title="Beauty Mode" icon={Sparkles}>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-zinc-400 text-sm">Skin smoothing intensity (Applied instantly)</p>
                          <span className="bg-violet-500/10 text-violet-300 font-bold px-3 py-1 rounded-lg text-sm">{((event.settings?.beautyLevel as number) || 0)} / 10</span>
                        </div>
                        <input type="range" min="0" max="10" step="1" value={(event.settings?.beautyLevel as number) || 0} onChange={e => updateSettings('beautyLevel', Number(e.target.value))} className="w-full accent-violet-500" />
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* ══ SHARING ══ */}
                {tab === 'sharing' && (
                  <div className="space-y-6">
                    <SectionCard title="Share Channels" icon={Share2}>
                      <div className="space-y-6">
                        {[
                          { key: 'allowEmailShare', icon: Mail, label: 'Email', default: true },
                          { key: 'allowSMSShare', icon: MessageCircle, label: 'SMS Text', default: false },
                          { key: 'allowWhatsApp', icon: Smartphone, label: 'WhatsApp', default: true },
                          { key: 'allowInstagram', icon: Instagram, label: 'Instagram Story Link', default: true }
                        ].map(item => (
                           <div key={item.key} className="flex items-center justify-between group">
                            <div className="flex gap-4 items-center">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                <item.icon className="w-5 h-5 text-zinc-300" />
                              </div>
                              <p className="text-zinc-200 text-sm font-medium">{item.label}</p>
                            </div>
                            <PremiumToggle checked={(event.settings?.[item.key] as boolean) ?? item.default} onChange={v => updateSettings(item.key, v)} />
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SectionCard title="Email Setup" icon={Mail}>
                        <div className="space-y-4">
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">From Name</label>
                            <input value={(event.settings?.emailFromName as string) || ''} onChange={e => updateSettings('emailFromName', e.target.value)} placeholder={event.name} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
                          </div>
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Email Subject</label>
                            <input value={(event.settings?.emailSubject as string) || ''} onChange={e => updateSettings('emailSubject', e.target.value)} placeholder={`Your photo from ${event.name} 📸`} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
                          </div>
                          <TestEmailButton eventId={event.id} />
                        </div>
                      </SectionCard>

                      <SectionCard title="Webhooks (Zapier/Make)" icon={LinkIcon}>
                        <div className="space-y-4">
                          <p className="text-zinc-500 text-sm">POST photo data instantly to CRM or automation tools.</p>
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Webhook URL</label>
                            <input type="url" value={(event.settings?.webhookUrl as string) || ''} onChange={e => updateSettings('webhookUrl', e.target.value)} placeholder="https://hooks.zapier.com/..." className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
                          </div>
                          <button disabled={webhookTesting || !(event.settings?.webhookUrl as string)} onClick={async () => {
                            setWebhookTesting(true);
                            try { const r = await testWebhook(event.id, event.settings?.webhookUrl as string); setWebhookResult(r.ok ? 'ok' : 'fail'); toast[r.ok?'success':'error'](r.ok?'Delivered':'Failed'); } catch { setWebhookResult('fail'); toast.error('Failed'); } finally { setWebhookTesting(false); }
                          }} className="w-full py-3 rounded-xl bg-violet-600/20 text-violet-300 font-semibold text-sm hover:bg-violet-600/30 disabled:opacity-40 transition-colors">
                            {webhookTesting ? 'Testing...' : 'Send Test Payload'}
                          </button>
                          {webhookResult === 'ok' && <p className="text-emerald-400 text-xs text-center">✅ Delivered successfully</p>}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                )}

                {/* ══ PRINTING ══ */}
                {tab === 'print' && (
                  <div className="space-y-6">
                    <SectionCard title="AirPrint Setup" icon={Printer}>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start mb-6">
                         <Wifi className="w-6 h-6 text-blue-400 shrink-0" />
                         <div>
                           <p className="text-blue-300 font-semibold text-sm mb-1">Native AirPrint Active</p>
                           <p className="text-blue-200/60 text-xs leading-relaxed">Ensure your iPad and Epson PM-520 are on the exact same WiFi network. The iPad will natively detect the printer when a guest taps Print.</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[ { key: '4x6', label: '4×6"' }, { key: '5x7', label: '5×7"' }, { key: 'a5', label: 'A5' }, { key: 'a4', label: 'A4' } ].map(size => (
                          <button key={size.key} onClick={() => updateSettings('paperSize', size.key)} className={`py-4 rounded-xl border text-sm font-bold transition-all ${((event.settings?.paperSize as string) || '4x6') === size.key ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 bg-zinc-900/50 text-zinc-500'}`}>{size.label}</button>
                        ))}
                      </div>
                    </SectionCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SectionCard title="Print Settings" icon={SlidersHorizontal}>
                        <div className="space-y-6">
                          <div>
                            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">Copies Allowed per Guest</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4].map(n => (
                                <button key={n} onClick={() => updateSettings('printCopies', n)} className={`flex-1 py-3 rounded-xl font-bold transition-all border ${((event.settings?.printCopies as number) || 1) === n ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{n}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div><p className="text-zinc-200 text-sm font-medium">Auto-Print</p><p className="text-zinc-500 text-xs mt-0.5">Skip print screen, print instantly</p></div>
                            <PremiumToggle checked={(event.settings?.autoPrint as boolean) ?? false} onChange={v => updateSettings('autoPrint', v)} />
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="Test Print" icon={Printer}>
                        <p className="text-zinc-400 text-sm mb-6">Send a test page to verify AirPrint connection and scaling.</p>
                        <button onClick={() => {
                          const w = window.open('', '_blank', 'width=400,height=500');
                          if(w) { w.document.write(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🖨️ Test Print</h2><script>setTimeout(()=>window.print(),500)</script></body></html>`); w.document.close(); }
                        }} className="w-full py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                          <Printer className="w-5 h-5" /> Fire Test Print
                        </button>
                      </SectionCard>
                    </div>
                  </div>
                )}

                {/* ══ PHOTOS GALLERY ══ */}
                {tab === 'photos' && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" /></span>
                        <span className="text-zinc-300 text-sm font-medium">Live Gallery Sync Active</span>
                      </div>
                      <button onClick={async () => { setZipLoading(true); try{ await downloadPhotosZip(event.id, event.name); toast.success('Downloading'); } catch {toast.error('Failed');} finally {setZipLoading(false);}}} disabled={zipLoading || photos.length === 0}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20 disabled:opacity-50">
                        {zipLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download All ({photos.length})
                      </button>
                    </div>

                    {photos.length === 0 ? (
                      <div className="text-center py-24 bg-zinc-900/20 border border-white/[0.04] rounded-2xl border-dashed">
                        <ImageIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                        <p className="text-zinc-400 font-medium">No photos captured yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {photos.map(photo => (
                          <div key={photo.id} className="group relative rounded-xl overflow-hidden aspect-[3/4] border border-zinc-800 bg-zinc-900">
                            <img src={photo.thumb_url || photo.url} alt="capture" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2 backdrop-blur-[2px]">
                              <a href={photo.url} target="_blank" className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium w-full py-2.5 rounded-lg text-center backdrop-blur-md transition-colors">View HD</a>
                              <button onClick={() => {if(confirm('Delete permanently?')) deletePhoto(photo.id).then(()=>setPhotos(p=>p.filter(x=>x.id!==photo.id)))}} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs font-medium w-full py-2.5 rounded-lg backdrop-blur-md transition-colors">Delete</button>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-md px-2 py-1 text-[10px] text-zinc-300 font-medium border border-white/10">
                              {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ══ MODERATION ══ */}
                {tab === 'moderation' && (
                  <div className="space-y-6">
                    <SectionCard title="Content Moderation" icon={EyeOff} description="Hidden photos are removed from the public gallery but kept on the server.">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-4">
                        {photos.map(photo => (
                          <div key={photo.id} className={`group relative rounded-xl overflow-hidden aspect-[3/4] border-2 transition-all ${photo.is_hidden ? 'border-red-500/50 opacity-60 grayscale' : 'border-zinc-800'}`}>
                            <img src={photo.thumb_url || photo.url} alt="capture" className="w-full h-full object-cover" />
                            {photo.is_hidden && <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg">HIDDEN</div>}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center p-3 gap-2">
                               <button onClick={async () => {
                                 try { photo.is_hidden ? await unhidePhoto(photo.id) : await hidePhoto(photo.id, 'admin'); setPhotos(p => p.map(x => x.id === photo.id ? {...x, is_hidden: !photo.is_hidden} : x)); } catch {toast.error('Failed');}
                               }} className={`w-full py-3 rounded-xl text-xs font-bold transition-colors ${photo.is_hidden ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                                 {photo.is_hidden ? 'Restore to Gallery' : 'Hide from Public'}
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* ══ LEADS ══ */}
                {tab === 'leads' && (
                  <SectionCard title="Captured Leads" icon={Users}>
                    <div className="flex items-center justify-between mb-4">
                      <button onClick={async () => { setLeadsLoading(true); try{ const d = await getEventLeads(event.id); setLeads(d.leads||[]); } finally{setLeadsLoading(false);} }} className="text-zinc-400 hover:text-white text-sm flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${leadsLoading?'animate-spin':''}`} /> Refresh</button>
                      <button onClick={() => { exportLeadsCSV(leads, event.name); toast.success('Exported!'); }} disabled={!leads.length} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">📥 Export CSV</button>
                    </div>
                    <div className="overflow-x-auto border border-white/[0.04] rounded-xl bg-zinc-950/50">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                          <tr><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Consent</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {leads.map(l => (
                            <tr key={l.id} className="hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 text-zinc-200">{l.email || '—'}</td>
                              <td className="px-4 py-3 text-zinc-400">{l.name || '—'}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${l.consented ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{l.consented ? 'YES' : 'NO'}</span></td>
                            </tr>
                          ))}
                          {leads.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-500">No leads captured yet. Enable lead capture in Capture settings.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}

                {/* ══ ANALYTICS ══ */}
                {tab === 'analytics' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { l: 'Photos', v: stats?.totalPhotos||0, c: 'text-violet-400', bg: 'bg-violet-500/10' },
                        { l: 'AI Generations', v: stats?.totalAIGenerated||0, c: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { l: 'Prints', v: stats?.totalPrints||0, c: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { l: 'Shares', v: stats?.totalShares||0, c: 'text-amber-400', bg: 'bg-amber-500/10' },
                      ].map(s => (
                        <div key={s.l} className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-lg">
                          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{s.l}</p>
                          <p className={`text-3xl font-black ${s.c}`}>{s.v}</p>
                        </div>
                      ))}
                    </div>
                    <SectionCard title="Live Dashboard" icon={Activity}><LiveDashboard eventId={event.id} /></SectionCard>
                    <SectionCard title="Historical Trends" icon={BarChart3}><AnalyticsDashboard eventId={event.id} /></SectionCard>
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
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 px-6 py-4 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-amber-400" /><div><p className="text-white text-sm font-semibold">Unsaved changes</p><p className="text-zinc-400 text-xs">Save edits to update the kiosk.</p></div></div>
            <div className="flex items-center gap-2 border-l border-white/10 pl-6">
              <button onClick={() => { setEvent(event); setIsDirty(false); }} className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors">Discard</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
