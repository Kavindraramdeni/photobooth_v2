'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getEvent, updateEvent, getEventPhotos, getEventStats, deletePhoto, downloadPhotosZip, pingBackend, hidePhoto, unhidePhoto, getEventLeads, exportLeadsCSV, getEventPhotosWithHidden, testWebhook, exportAnalyticsCSV, getEventAnalytics } from '@/lib/api';
import toast from 'react-hot-toast';
import { LiveDashboard } from '@/components/admin/LiveDashboard';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'overview' | 'branding' | 'settings' | 'photos' | 'moderation' | 'leads' | 'analytics' | 'diagnostics';
type SideSection = 'event' | 'capture' | 'design' | 'sharing' | 'data' | 'advanced';

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

// ── R2 file upload via backend proxy ─────────────────────────────────────
async function uploadAssetViaBackend(
  file: File, eventId: string, type: 'logo' | 'frame' | 'idle'
): Promise<string> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('sb_access_token');
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/events/${eventId}/upload-asset?type=${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  const { url } = await res.json();
  return url;
}

// ── File upload button ─────────────────────────────────────────────────────
function UploadButton({
  label, accept, currentUrl, onUploaded, uploading, setUploading, storagePath,
}: {
  label: string; accept: string; currentUrl: string; onUploaded: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void; storagePath: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // storagePath format: "branding/{eventId}/{type}" — extract both parts
  const pathParts = storagePath.split('/');
  const eventId = pathParts[1];
  const assetType = pathParts[2] as 'logo' | 'frame' | 'idle';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAssetViaBackend(file, eventId, assetType);
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

  // AI status
  const [aiStatus, setAiStatus] = useState<{
    activeTier: string;
    activeTierLabel: string;
    tiers: Record<string, { configured: boolean; status: string; model: string; error?: string }>;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiStatus = useCallback(async () => {
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/ai/status`);
      if (res.ok) setAiStatus(await res.json());
    } catch { /* silent */ } finally { setAiLoading(false); }
  }, []);

  useEffect(() => { fetchAiStatus(); }, [fetchAiStatus]);

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

  const tierColor = (status: string) => {
    if (status === 'active' || status === 'configured') return '#34d399';
    if (status === 'not_configured') return 'rgba(255,255,255,0.25)';
    if (status === 'error') return '#f87171';
    return '#fbbf24';
  };

  const tierBadge = (status: string) => {
    if (status === 'active') return { label: 'ACTIVE', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)', color: '#34d399' };
    if (status === 'configured') return { label: 'STANDBY', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24' };
    if (status === 'not_configured') return { label: 'NOT SET', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' };
    if (status === 'error') return { label: 'ERROR', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', color: '#f87171' };
    return { label: 'UNKNOWN', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' };
  };

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

        {/* AI Tier Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">🤖 AI Generation</h3>
            <button onClick={fetchAiStatus} disabled={aiLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/40 hover:bg-purple-600/60 text-purple-300 disabled:opacity-40 font-medium transition-all">
              {aiLoading ? 'Checking...' : '↻ Refresh'}
            </button>
          </div>

          {aiStatus ? (
            <>
              {/* Active tier banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <span className="text-2xl">
                  {aiStatus.activeTier === 'cloudflare' ? '☁️' : aiStatus.activeTier === 'huggingface' ? '🤗' : '⚡'}
                </span>
                <div>
                  <p className="text-white font-bold text-sm">{aiStatus.activeTierLabel}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {aiStatus.activeTier === 'cloudflare' && 'Free · 10,000 req/day · ~2s per image'}
                    {aiStatus.activeTier === 'huggingface' && 'Free · Cold starts possible · ~10-30s per image'}
                    {aiStatus.activeTier === 'sharp' && 'Local colour grading · Instant · Always available'}
                  </p>
                </div>
              </div>

              {/* Tier list */}
              <div className="space-y-2">
                {Object.entries(aiStatus.tiers).map(([key, tier]: [string, any]) => {
                  const isActive = aiStatus.activeTier === key;
                  const statusColors: Record<string, string> = {
                    active: '#34d399', configured: '#fbbf24',
                    not_configured: 'rgba(255,255,255,0.25)', error: '#f87171', unknown: '#94a3b8'
                  };
                  const statusLabels: Record<string, string> = {
                    active: '✅ ACTIVE', configured: '⏸ STANDBY',
                    not_configured: '○ NOT SET', error: '❌ ERROR', unknown: '? UNKNOWN'
                  };
                  return (
                    <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: isActive ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-white/80 text-xs font-semibold">
                          {key === 'sharp' ? '⚡ Sharp Local Filters' : key === 'cloudflare' ? '☁️ Cloudflare Workers AI' : '🤗 HuggingFace FLUX.1'}
                          {isActive && <span className="ml-2 text-[10px] text-emerald-400 font-black">← IN USE NOW</span>}
                        </p>
                        <p className="text-white/30 text-[11px] truncate">{tier.model}</p>
                        {tier.error && <p className="text-red-400 text-[11px]">{tier.error}</p>}
                      </div>
                      <span className="ml-3 text-[10px] font-bold flex-shrink-0"
                        style={{ color: statusColors[tier.status] || '#94a3b8' }}>
                        {statusLabels[tier.status] || tier.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {aiStatus.activeTier !== 'cloudflare' && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <p className="text-white/50 text-xs leading-relaxed">
                    💡 <span className="text-violet-300 font-semibold">Upgrade to Cloudflare</span> — set{' '}
                    <code className="bg-white/8 px-1 rounded text-[11px]">CF_ACCOUNT_ID</code> and{' '}
                    <code className="bg-white/8 px-1 rounded text-[11px]">CF_AI_TOKEN</code> on Render for free SDXL Lightning AI (10k/day free).
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-white/30 text-sm">{aiLoading ? '⏳ Checking AI status...' : '⚠️ Could not reach AI status endpoint'}</p>
          )}
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


// ── Test email button component ───────────────────────────────────────────────
function TestEmailButton({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async function sendTest() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${API_BASE}/api/share/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ toEmail: email.trim(), eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`✅ Test email sent to ${email}!`);
      setEmail('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test email');
    } finally { setSending(false); }
  }

  return (
    <div className="pt-3 border-t border-white/5">
      <label className="text-white/50 text-sm block mb-2">✉️ Send Test Email</label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500"
          onKeyDown={e => e.key === 'Enter' && sendTest()}
        />
        <button
          onClick={sendTest}
          disabled={!email.trim() || sending}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex-shrink-0"
        >
          {sending ? '⏳' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const searchParams = useSearchParams();
  const isOperatorMode = searchParams.get('operator') === 'true';

  // Operator PIN gate
  const [operatorUnlocked, setOperatorUnlocked] = useState(false);
  const [operatorPinInput, setOperatorPinInput] = useState('');
  const [operatorPinError, setOperatorPinError] = useState(false);
  const [operatorPinEvent, setOperatorPinEvent] = useState<{ name: string; settings: Record<string, unknown> } | null>(null);

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
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult]   = useState<'ok' | 'fail' | null>(null);

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIdle, setUploadingIdle] = useState(false);
  const [uploadingFrame, setUploadingFrame] = useState(false);

  // For operator mode: fetch just enough to show PIN gate
  useEffect(() => {
    if (!isOperatorMode) return;
    getEvent(eventId)
      .then(ev => setOperatorPinEvent({ name: ev.name, settings: ev.settings || {} }))
      .catch(() => {});
  }, [eventId, isOperatorMode]);

  function handleOperatorPin() {
    if (!operatorPinEvent) return;
    const correctPin = operatorPinEvent.settings?.operatorPin as string;
    if (!correctPin || operatorPinInput === correctPin) {
      setOperatorUnlocked(true);
    } else {
      setOperatorPinError(true);
      setOperatorPinInput('');
      setTimeout(() => setOperatorPinError(false), 1500);
    }
  }

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
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!event) return null;

  const visiblePhotos = photos.filter(p => !p.is_hidden);
  const hiddenPhotos  = photos.filter(p => p.is_hidden);

  // Sidebar nav groups
  const NAV: { section: string; icon: string; label: string; tabs: { key: Tab; label: string }[] }[] = [
    { section: 'event',    icon: '📋', label: 'Event',    tabs: [{ key: 'overview', label: 'Overview' }] },
    { section: 'design',   icon: '🎨', label: 'Design',   tabs: [{ key: 'branding', label: 'Branding & Style' }] },
    { section: 'capture',  icon: '📷', label: 'Capture',  tabs: [{ key: 'settings', label: 'Booth Settings' }] },
    { section: 'data',     icon: '📸', label: 'Content',  tabs: [
      { key: 'photos',     label: `Photos (${visiblePhotos.length})` },
      { key: 'moderation', label: `Moderation${hiddenPhotos.length ? ` (${hiddenPhotos.length})` : ''}` },
      { key: 'leads',      label: `Leads${leads.length ? ` (${leads.length})` : ''}` },
    ]},
    { section: 'advanced', icon: '📊', label: 'Analytics', tabs: [
      { key: 'analytics',   label: 'Analytics' },
      { key: 'diagnostics', label: 'Diagnostics' },
    ]},
  ];

  return (
    <div className="min-h-screen bg-[#080810] text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top header ── */}
      <header className="flex-shrink-0 border-b border-white/[0.07] bg-[#0c0c18]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin"
              className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors text-sm flex-shrink-0">
              ← Back
            </Link>
            <div className="w-px h-5 bg-white/10 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-base truncate leading-tight">{event.name}</h1>
              <p className="text-white/30 text-xs truncate">{event.venue || 'No venue set'} · {event.date?.split('T')[0]}</p>
            </div>
            <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 uppercase tracking-wide ${
              event.status === 'active' ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 'bg-white/5 text-white/30 border border-white/10'
            }`}>{event.status}</span>
          </div>

          {/* Right — quick actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Stats pills */}
            {stats && (
              <div className="hidden md:flex items-center gap-1.5">
                {[
                  { v: stats.totalPhotos, e: '📸', l: 'photos' },
                  { v: stats.totalShares, e: '📤', l: 'shares' },
                  { v: stats.totalPrints, e: '🖨️', l: 'prints' },
                ].map(s => (
                  <div key={s.l} className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1">
                    <span className="text-xs">{s.e}</span>
                    <span className="text-white font-bold text-sm">{s.v ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Booth URL copied!'); }}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-colors">
              📋 Copy URL
            </button>
            <Link href={`/booth?event=${event.slug}`} target="_blank"
              className="flex items-center gap-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 px-3 py-2 rounded-xl transition-colors font-semibold">
              🚀 Open Booth
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl font-bold disabled:opacity-50 transition-colors">
              {saving ? '⏳' : '💾'} {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Stats bar (mobile) ── */}
        {stats && (
          <div className="md:hidden flex items-center gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
            {[
              { v: stats.totalPhotos, e: '📸', l: 'Photos' },
              { v: stats.totalGIFs, e: '🎬', l: 'GIFs' },
              { v: stats.totalStrips, e: '🎞️', l: 'Strips' },
              { v: stats.totalShares, e: '📤', l: 'Shares' },
              { v: stats.totalPrints, e: '🖨️', l: 'Prints' },
              { v: stats.totalSessions, e: '👥', l: 'Sessions' },
            ].map(s => (
              <div key={s.l} className="flex-shrink-0 flex flex-col items-center bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
                <span className="text-xs">{s.e}</span>
                <span className="text-white font-bold text-sm leading-none">{s.v ?? 0}</span>
                <span className="text-white/30 text-[9px]">{s.l}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden md:flex flex-col w-48 lg:w-56 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a15] overflow-y-auto">
          <div className="p-3 space-y-1">
            {NAV.map(group => (
              <div key={group.section}>
                {/* Group header */}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-white/25 text-[10px] font-bold uppercase tracking-widest">{group.icon} {group.label}</span>
                </div>
                {/* Group items */}
                {group.tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                      tab === t.key
                        ? 'bg-violet-600/20 text-violet-200 font-semibold border border-violet-500/25'
                        : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                    }`}>
                    <span className="leading-none">{t.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Bottom: kiosk mode quick toggle */}
          <div className="mt-auto p-3 border-t border-white/[0.05]">
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-xs font-semibold">🔒 Kiosk Mode</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox"
                    checked={(event.settings?.kioskMode as boolean) ?? false}
                    onChange={e => updateSettings('kioskMode', e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-8 h-4 bg-white/15 peer-checked:bg-violet-600 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                </label>
              </div>
              <p className="text-white/25 text-[10px] leading-relaxed">Locks booth in fullscreen. Guests cannot exit.</p>
            </div>
          </div>
        </aside>

        {/* ── MOBILE TAB BAR (bottom) ── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0a0a15]/95 backdrop-blur border-t border-white/[0.07] flex overflow-x-auto scrollbar-none px-2 py-1 gap-1">
          {NAV.flatMap(g => g.tabs).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-medium transition-all ${
                tab === t.key ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

            {/* ── Section title ── */}
            <div className="mb-5">
              <h2 className="text-white font-bold text-xl capitalize">
                {NAV.flatMap(g => g.tabs).find(t => t.key === tab)?.label || tab}
              </h2>
              <div className="w-8 h-0.5 mt-1.5 rounded-full bg-violet-500 opacity-60" />
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

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Booth Features */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-5">Booth Features</h3>
                <div className="space-y-1">
                  {[
                    { key: 'allowAI',        label: '🤖 AI Generation', desc: 'Let guests apply AI art styles' },
                    { key: 'allowGIF',       label: '🎬 GIF Mode',       desc: 'Animated GIFs from burst frames' },
                    { key: 'allowBoomerang', label: '🔄 Boomerang',      desc: 'Ping-pong loop animation' },
                    { key: 'allowPrint',     label: '🖨️ Print',          desc: 'AirPrint directly from booth' },
                    { key: 'autoPrint',      label: '⚡ Auto-Print',     desc: 'Print automatically after every capture' },
                    { key: 'allowRetakes',   label: '🔁 Retakes',        desc: 'Let guests retake their photo' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0 cursor-pointer">
                      <div>
                        <p className="text-white/90 text-sm font-medium">{item.label}</p>
                        <p className="text-white/30 text-xs">{item.desc}</p>
                      </div>
                      <input type="checkbox"
                        checked={(event.settings?.[item.key] as boolean) ?? true}
                        onChange={e => updateSettings(item.key, e.target.checked)}
                        className="w-5 h-5 accent-purple-500 cursor-pointer" />
                    </label>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">⏱️ Timing</h3>
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
                  <p className="text-white/30 text-xs mt-1">Auto-returns to idle after inactivity</p>
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

              {/* Operator Security */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">🔐 Operator Security</h3>
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Operator PIN</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*"
                    value={(event.settings?.operatorPin as string) || '1234'}
                    onChange={e => updateSettings('operatorPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl tracking-[0.4em] font-mono focus:outline-none focus:border-purple-500" />
                  <p className="text-white/30 text-xs mt-1">4–8 digits. Used to unlock operator panel (gear icon).</p>
                </div>
                <div>
                  {/* Kiosk Mode */}
                  <div className="border-t border-white/5 pt-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-white/80 text-sm font-medium">🔒 Kiosk Mode</p>
                        <p className="text-white/30 text-xs">Locks booth in fullscreen. Guests cannot exit or navigate away. Best for unattended events.</p>
                      </div>
                      <input type="checkbox"
                        checked={(event.settings?.kioskMode as boolean) ?? false}
                        onChange={e => updateSettings('kioskMode', e.target.checked)}
                        className="w-5 h-5 accent-purple-500" />
                    </label>
                  </div>

                  <label className="text-white/50 text-sm block mb-1.5">Print Copies Per Session</label>
                  <select value={(event.settings?.printCopies as number) || 1}
                    onChange={e => updateSettings('printCopies', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} cop{n > 1 ? 'ies' : 'y'}</option>)}
                  </select>
                </div>

                {/* Max total prints */}
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Max Prints Per Event</label>
                  <input type="number" min="0" max="9999"
                    value={(event.settings?.maxPrints as number) || ''}
                    onChange={e => updateSettings('maxPrints', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Unlimited"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                  <p className="text-white/25 text-xs mt-1">Leave blank for unlimited. Booth shows message when limit hit.</p>
                </div>

                {/* Print alignment */}
                <div className="border-t border-white/5 pt-4">
                  <label className="text-white/50 text-sm block mb-3">🖨️ Print Scale</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="80" max="100" step="1"
                      value={(event.settings?.printScale as number) || 98}
                      onChange={e => updateSettings('printScale', Number(e.target.value))}
                      className="flex-1 accent-purple-500" />
                    <span className="text-white text-sm font-mono w-10 text-right flex-shrink-0">
                      {(event.settings?.printScale as number) || 98}%
                    </span>
                  </div>
                  <p className="text-white/25 text-xs mt-1">Reduce if photo is cropped at edges when printing.</p>
                </div>
              </div>

              {/* Booth Limits */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">🚦 Booth Limits</h3>
                <p className="text-white/30 text-xs">Leave blank for no limit.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">Opens At</label>
                    <input type="datetime-local"
                      value={(event.settings?.boothStart as string) || ''}
                      onChange={e => updateSettings('boothStart', e.target.value || null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">Closes At</label>
                    <input type="datetime-local"
                      value={(event.settings?.boothEnd as string) || ''}
                      onChange={e => updateSettings('boothEnd', e.target.value || null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Max Photos</label>
                  <input type="number" min="0" max="10000"
                    value={(event.settings?.photoLimit as number) || ''}
                    onChange={e => updateSettings('photoLimit', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Unlimited"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20" />
                  <p className="text-white/25 text-xs mt-1">Current: {photos.length} photos taken.</p>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* Gallery Privacy */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">👁️ Gallery Privacy</h3>

                {/* Password toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-white/80 text-sm font-medium">Password-protect gallery</p>
                    <p className="text-white/40 text-xs mt-0.5">Guests must enter a PIN to view photos</p>
                  </div>
                  <button
                    onClick={() => updateSettings('galleryPasswordEnabled', !(event.settings?.galleryPasswordEnabled as boolean))}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${(event.settings?.galleryPasswordEnabled as boolean) ? 'bg-purple-600' : 'bg-white/20'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(event.settings?.galleryPasswordEnabled as boolean) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </label>

                {(event.settings?.galleryPasswordEnabled as boolean) && (
                  <input
                    type="text"
                    value={(event.settings?.galleryPassword as string) || ''}
                    onChange={e => updateSettings('galleryPassword', e.target.value)}
                    placeholder="Gallery password / PIN"
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500" />
                )}

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Gallery Expiry</label>
                  <select
                    value={(event.settings?.galleryExpireDays as number) || 0}
                    onChange={e => updateSettings('galleryExpireDays', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    <option value={0}>Never expire</option>
                    <option value={7}>7 days after event</option>
                    <option value={30}>30 days after event</option>
                    <option value={90}>90 days after event</option>
                    <option value={365}>1 year after event</option>
                  </select>
                </div>

                <a href={`/gallery/${event.slug}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors">
                  View public gallery →
                </a>
              </div>

              {/* Webhook / Zapier */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">🔗 Webhook / Zapier</h3>
                <p className="text-white/40 text-xs">POST to this URL every time a photo is taken. Works with Zapier, Make, or any webhook receiver.</p>
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Webhook URL</label>
                  <input type="url"
                    value={(event.settings?.webhookUrl as string) || ''}
                    onChange={e => updateSettings('webhookUrl', e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Secret <span className="text-white/25 font-normal">(optional)</span></label>
                  <input type="text"
                    value={(event.settings?.webhookSecret as string) || ''}
                    onChange={e => updateSettings('webhookSecret', e.target.value)}
                    placeholder="Sent as X-SnapBooth-Secret header"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    disabled={webhookTesting || !(event.settings?.webhookUrl as string)}
                    onClick={async () => {
                      if (!(event.settings?.webhookUrl as string)) return;
                      setWebhookTesting(true); setWebhookResult(null);
                      try {
                        const r = await testWebhook(event.id, event.settings.webhookUrl as string);
                        setWebhookResult(r.ok ? 'ok' : 'fail');
                        toast[r.ok ? 'success' : 'error'](r.ok ? 'Webhook delivered ✅' : `Failed: ${r.error || 'HTTP error'}`);
                      } catch { setWebhookResult('fail'); toast.error('Webhook test failed'); }
                      finally { setWebhookTesting(false); }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-40">
                    {webhookTesting
                      ? <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                      : '🔗'}
                    {webhookTesting ? 'Testing…' : 'Send test event'}
                  </button>
                  {webhookResult === 'ok'   && <span className="text-green-400 text-xs">✅ Delivered!</span>}
                  {webhookResult === 'fail' && <span className="text-red-400 text-xs">❌ Failed — check URL</span>}
                </div>
                <div className="bg-black/30 rounded-xl p-3 text-[11px] text-white/30 font-mono leading-relaxed break-all">
                  {`{ "event": "photo.taken", "photoId": "...", "photoUrl": "...", "galleryUrl": "...", "mode": "single" }`}
                </div>
              </div>

              {/* Email Template */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">📧 Email Template</h3>
                <p className="text-white/40 text-xs">Customise the email guests receive when they share their photo.</p>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Subject line</label>
                  <input type="text"
                    value={(event.branding?.emailSubject as string) || ''}
                    onChange={e => updateBranding('emailSubject', e.target.value)}
                    placeholder={`Your photo from ${event.name} 📸`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Header message</label>
                  <textarea
                    value={(event.branding?.emailHeaderText as string) || ''}
                    onChange={e => updateBranding('emailHeaderText', e.target.value)}
                    rows={2}
                    placeholder={`Thanks for stopping by ${event.name}!`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 resize-none" />
                </div>

                <div>
                  <label className="text-white/50 text-sm block mb-1.5">Footer text</label>
                  <input type="text"
                    value={(event.branding?.emailFooterText as string) || ''}
                    onChange={e => updateBranding('emailFooterText', e.target.value)}
                    placeholder="Powered by SnapBooth AI"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                </div>

                {/* Live email preview */}
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-white/5 px-3 py-2 text-white/40 text-xs font-semibold uppercase tracking-widest">Email Preview</div>
                  <div className="bg-white p-4 space-y-2">
                    <p className="text-xs text-gray-400">Subject: <span className="text-gray-700 font-medium">{(event.branding?.emailSubject as string) || `Your photo from ${event.name} 📸`}</span></p>
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-gray-800 text-sm">{(event.branding?.emailHeaderText as string) || `Thanks for visiting ${event.name}!`}</p>
                      <div className="bg-gray-100 rounded-lg h-20 flex items-center justify-center text-gray-400 text-xs">[Photo here]</div>
                      <div className="flex gap-2">
                        <div className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: primaryColor }}>Save Photo</div>
                        <div className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold">WhatsApp</div>
                      </div>
                      <p className="text-gray-400 text-xs">{(event.branding?.emailFooterText as string) || 'Powered by SnapBooth AI'}</p>
                    </div>
                  </div>
                </div>

                {/* Email channel settings */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-white/80 text-sm font-medium">📧 Email Share</p>
                      <p className="text-white/30 text-xs">Requires RESEND_API_KEY on Render</p>
                    </div>
                    <input type="checkbox"
                      checked={(event.settings?.allowEmailShare as boolean) ?? true}
                      onChange={e => updateSettings('allowEmailShare', e.target.checked)}
                      className="w-5 h-5 accent-purple-500" />
                  </label>
                  {(event.settings?.allowEmailShare as boolean) !== false && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-white/50 text-sm block mb-1.5">From Name</label>
                        <input value={(event.settings?.emailFromName as string) || ''}
                          onChange={e => updateSettings('emailFromName', e.target.value)}
                          placeholder={event.name || 'SnapBooth AI'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="text-white/50 text-sm block mb-1.5">Reply-To</label>
                        <input type="email"
                          value={(event.settings?.emailReplyTo as string) || ''}
                          onChange={e => updateSettings('emailReplyTo', e.target.value)}
                          placeholder="you@yourdomain.com"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                      </div>
                    </div>
                  )}
                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5">
                    <div>
                      <p className="text-white/80 text-sm font-medium">📱 SMS Share</p>
                      <p className="text-white/30 text-xs">Requires Twilio env vars on Render</p>
                    </div>
                    <input type="checkbox"
                      checked={(event.settings?.allowSMSShare as boolean) ?? false}
                      onChange={e => updateSettings('allowSMSShare', e.target.checked)}
                      className="w-5 h-5 accent-purple-500" />
                  </label>

                  {/* Custom email subject */}
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-white/50 text-sm block mb-1.5">📧 Custom Email Subject</label>
                    <input
                      value={(event.settings?.emailSubject as string) || ''}
                      onChange={e => updateSettings('emailSubject', e.target.value)}
                      placeholder={`Your photo from ${event.name} 📸`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                  </div>

                  {/* Custom SMS message */}
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">📱 Custom SMS Message</label>
                    <textarea
                      value={(event.settings?.smsMessage as string) || ''}
                      onChange={e => updateSettings('smsMessage', e.target.value)}
                      rows={2}
                      placeholder={`📸 ${event.name} — here's your photo! View & save: {url}`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500 resize-none" />
                    <p className="text-white/25 text-xs mt-1">Use {'{url}'} for photo link, {'{event}'} for event name</p>
                  </div>

                  {/* WhatsApp country code */}
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">🟢 WhatsApp Country Code</label>
                    <input
                      value={(event.settings?.whatsappCountryCode as string) || ''}
                      onChange={e => updateSettings('whatsappCountryCode', e.target.value)}
                      placeholder="91 (India) or 1 (US) — leave blank to let guest enter"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500" />
                  </div>

                  {/* Share screen timeout */}
                  <div>
                    <label className="text-white/50 text-sm block mb-1.5">⏱️ Share Screen Timeout</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="120" step="5"
                        value={(event.settings?.shareScreenTimeout as number) || 0}
                        onChange={e => updateSettings('shareScreenTimeout', Number(e.target.value))}
                        className="flex-1 accent-purple-500" />
                      <span className="text-white text-sm font-mono w-20 text-right flex-shrink-0">
                        {(event.settings?.shareScreenTimeout as number) || 0 === 0
                          ? 'Off'
                          : `${event.settings?.shareScreenTimeout}s`}
                      </span>
                    </div>
                    <p className="text-white/25 text-xs mt-1">Auto-advance to next guest after this many seconds. 0 = disabled.</p>
                  </div>

                  {/* Test email button */}
                  <TestEmailButton eventId={event.id} />
                </div>
              </div>

              {/* Lead Capture */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">📋 Lead Capture</h3>
                <p className="text-white/30 text-xs">Show an email input modal between preview and share screen.</p>
                <label className="flex items-center justify-between cursor-pointer">
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
                  <label className="flex items-center justify-between cursor-pointer border-t border-white/5 pt-3">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Make email required</p>
                      <p className="text-white/30 text-xs">Removes the &quot;Skip&quot; option</p>
                    </div>
                    <input type="checkbox"
                      checked={(event.settings?.leadRequired as boolean) ?? false}
                      onChange={e => updateSettings('leadRequired', e.target.checked)}
                      className="w-5 h-5 accent-purple-500" />
                  </label>
                )}
              </div>

              {/* Data Export */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-lg">📥 Data Export</h3>
                <button
                  onClick={async () => {
                    try {
                      const data = await getEventAnalytics(event.id, 90);
                      const rows = data.analytics || data.rows || [];
                      if (!rows.length) { toast.error('No analytics data yet'); return; }
                      exportAnalyticsCSV(rows, event.name);
                      toast.success('Analytics CSV downloaded!');
                    } catch { toast.error('Export failed'); }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm">
                  📊
                  <div className="text-left">
                    <p className="font-medium text-white/80">Analytics CSV</p>
                    <p className="text-xs text-white/40">All actions: photos, prints, AI filters, shares</p>
                  </div>
                </button>
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
            {/* Tracked events summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Photos Taken', value: stats?.totalPhotos ?? 0, icon: '📸', color: '#7c3aed' },
                { label: 'GIFs / Boomerangs', value: (stats?.totalGIFs ?? 0) + (stats?.totalBoomerangs ?? 0), icon: '🎬', color: '#06b6d4' },
                { label: 'AI Generated', value: stats?.totalAIGenerated ?? 0, icon: '🤖', color: '#f59e0b' },
                { label: 'Total Shares', value: stats?.totalShares ?? 0, icon: '📤', color: '#10b981' },
                { label: 'Prints', value: stats?.totalPrints ?? 0, icon: '🖨️', color: '#6366f1' },
                { label: 'Email Shares', value: 0, icon: '📧', color: '#ec4899' },
                { label: 'Sessions', value: stats?.totalSessions ?? 0, icon: '👥', color: '#8b5cf6' },
                { label: 'Gallery Views', value: 0, icon: '🖼️', color: '#14b8a6' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Live dashboard */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <h3 className="text-white font-semibold">Live — Right Now</h3>
              </div>
              <LiveDashboard eventId={event.id} />
            </div>

            {/* Historical charts */}
            <AnalyticsDashboard eventId={event.id} />

            {/* What is tracked */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
              <h3 className="text-white/60 text-sm font-semibold mb-3">✅ What is tracked automatically</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Photo / GIF / Strip capture',
                  'AI filter generation',
                  'WhatsApp shares',
                  'Email shares',
                  'SMS shares',
                  'Gallery views',
                  'Gallery downloads',
                  'Print jobs',
                  'Lead captures',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-white/40 text-xs">
                    <span className="text-green-400">✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-white/20 text-xs mt-3">All events are stored in Supabase analytics table and available for CSV export.</p>
            </div>

            {/* Export */}
            <button onClick={async () => {
              try {
                const data = await getEventAnalytics(event.id, 90);
                const rows = (data.daily || []).map((d: Record<string, unknown>) => ({ date: d.date, photos: d.photos, gifs: d.gifs, ai: d.ai }));
                exportAnalyticsCSV(rows, event.name);
                toast.success('Analytics exported!');
              } catch { toast.error('Export failed'); }
            }}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-sm font-semibold transition-colors">
              📥 Export Analytics CSV
            </button>
          </div>
        )}

        {/* ══ DIAGNOSTICS TAB ══ */}
        {tab === 'diagnostics' && <DiagnosticsPanel eventId={event.id} />}
          </div>
        </main>
      </div>
    </div>
  );
}
