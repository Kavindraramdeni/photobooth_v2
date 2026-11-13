'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrintDeliveryHubProps {
  event: { id: string; name: string; slug: string; settings: Record<string, unknown> };
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
  API_BASE: string;
}

interface PrintJob {
  id: string;
  photo_url: string;
  thumb_url?: string;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  created_at: string;
}

// ─── Helper: auth token ───────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sb_access_token') ?? '';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Dark glass-morphism card wrapper */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wider text-white/60">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Row label + control */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/70 text-sm">{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/** Toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        checked ? 'bg-indigo-500' : 'bg-white/15'
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/** Inline "premium" pill — marks features that need a plan upgrade */
function PremiumToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-amber-400 font-medium">PRO</span>}
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/** Status badge for print queue */
function StatusBadge({ status }: { status: PrintJob['status'] }) {
  const map: Record<PrintJob['status'], string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    printing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PrintDeliveryHub({
  event,
  settings,
  onSettingsChange,
  onSave,
  saving,
  dirty,
  API_BASE,
}: PrintDeliveryHubProps) {
  // ── print queue state ──
  const [queue, setQueue] = useState<PrintJob[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // ── email test state ──
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // ── gallery password state ──
  const [galleryPassword, setGalleryPassword] = useState(
    (event.settings?.gallery_password as string) ?? '',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // ─── Fetch print queue ───────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch(`${API_BASE}/api/print/queue/${event.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load queue');
      const data = await res.json();
      setQueue(Array.isArray(data) ? data : data.jobs ?? []);
    } catch (err) {
      toast.error('Could not load print queue');
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  }, [API_BASE, event.id]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ─── Test print (browser print dialog) ──────────────────────────────────

  function handleTestPrint() {
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) {
      toast.error('Could not open print window. Check pop-up blocker.');
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Print — ${event.name}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column;
                   align-items: center; justify-content: center; height: 100vh; margin: 0; }
            h1 { font-size: 2rem; }
            p  { color: #666; }
          </style>
        </head>
        <body>
          <h1>🖨️ SnapBooth Test Print</h1>
          <p>Event: <strong>${event.name}</strong></p>
          <p>Scale: ${settings.printScale ?? 100}%</p>
          <p>Copies: ${settings.printCopies ?? 1}</p>
          <script>window.onload = () => window.print();<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  // ─── Send test email ─────────────────────────────────────────────────────

  async function handleSendTestEmail() {
    if (!testEmail) {
      toast.error('Enter an email address first');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch(`${API_BASE}/api/share/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ toEmail: testEmail, eventId: event.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Test email sent!');
    } catch (err) {
      toast.error('Failed to send test email');
      console.error(err);
    } finally {
      setSendingTest(false);
    }
  }

  // ─── Save gallery password ───────────────────────────────────────────────

  async function handleSavePassword() {
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ gallery_password: galleryPassword }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Gallery password saved');
    } catch (err) {
      toast.error('Failed to save password');
      console.error(err);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleClearPassword() {
    setGalleryPassword('');
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ gallery_password: '' }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Gallery password cleared');
    } catch (err) {
      toast.error('Failed to clear password');
      console.error(err);
    } finally {
      setSavingPassword(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Global save bar ── */}
      {dirty && (
        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3">
          <span className="text-indigo-300 text-sm">You have unsaved changes</span>
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── 1. Print Setup ── */}
      <Card title="🖨️ Print Setup">
        <SettingRow label="Auto Print">
          <Toggle
            checked={!!settings.autoPrint}
            onChange={(v) => onSettingsChange('autoPrint', v)}
          />
        </SettingRow>

        <SettingRow label={`Print Scale: ${settings.printScale ?? 100}%`}>
          <input
            type="range"
            min={50}
            max={100}
            value={(settings.printScale as number) ?? 100}
            onChange={(e) => onSettingsChange('printScale', Number(e.target.value))}
            className="w-32 accent-indigo-400"
          />
        </SettingRow>

        <SettingRow label="Copies per Print">
          <select
            value={(settings.printCopies as number) ?? 1}
            onChange={(e) => onSettingsChange('printCopies', Number(e.target.value))}
            className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={1}>1 copy</option>
            <option value={2}>2 copies</option>
            <option value={3}>3 copies</option>
          </select>
        </SettingRow>

        <div className="pt-1">
          <button
            onClick={handleTestPrint}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            🖨️ Send Test Page
          </button>
        </div>
      </Card>

      {/* ── 2. Active Print Queue ── */}
      <Card title="📋 Active Print Queue">
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs">Live job status</span>
          <button
            onClick={fetchQueue}
            disabled={loadingQueue}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors disabled:opacity-50"
          >
            {loadingQueue ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {loadingQueue ? (
          <div className="text-center py-8 text-white/30 text-sm">Loading queue…</div>
        ) : queue.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No pending print jobs</div>
        ) : (
          <div className="flex flex-col gap-2">
            {queue.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
              >
                {/* thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {(job.thumb_url || job.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.thumb_url ?? job.photo_url}
                      alt="print job"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                      📷
                    </div>
                  )}
                </div>
                {/* info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 text-xs truncate">{job.id}</p>
                  <p className="text-white/30 text-xs">
                    {new Date(job.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. Email Delivery ── */}
      <Card title="✉️ Email Delivery">
        <SettingRow label="Allow Email Share">
          <PremiumToggle
            checked={!!settings.allowEmailShare}
            onChange={(v) => onSettingsChange('allowEmailShare', v)}
            label="PRO"
          />
        </SettingRow>

        <div className="flex flex-col gap-3 pt-1">
          <label className="flex flex-col gap-1">
            <span className="text-white/50 text-xs">Email From Name</span>
            <input
              type="text"
              value={(settings.emailFromName as string) ?? ''}
              onChange={(e) => onSettingsChange('emailFromName', e.target.value)}
              placeholder="SnapBooth Photos"
              className="bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/25"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-white/50 text-xs">Email Reply-To</span>
            <input
              type="email"
              value={(settings.emailReplyTo as string) ?? ''}
              onChange={(e) => onSettingsChange('emailReplyTo', e.target.value)}
              placeholder="hello@yourevent.com"
              className="bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/25"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-white/50 text-xs">Custom Email Subject</span>
            <input
              type="text"
              value={(settings.emailSubject as string) ?? ''}
              onChange={(e) => onSettingsChange('emailSubject', e.target.value)}
              placeholder="Your photos from {{event_name}} are ready!"
              className="bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/25"
            />
          </label>
        </div>

        {/* Test email */}
        <div className="pt-2 border-t border-white/8">
          <p className="text-white/40 text-xs mb-2">Send a test email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/25"
            />
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {sendingTest ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          <span className="text-blue-400 text-xs">ℹ️</span>
          <span className="text-blue-300 text-xs">Using Resend API for email delivery</span>
        </div>
      </Card>

      {/* ── 4. Digital Sharing ── */}
      <Card title="📱 Digital Sharing">
        <SettingRow label="Allow SMS Share">
          <PremiumToggle
            checked={!!settings.allowSMSShare}
            onChange={(v) => onSettingsChange('allowSMSShare', v)}
            label="PRO"
          />
        </SettingRow>
        <SettingRow label="Allow WhatsApp">
          <Toggle
            checked={!!settings.allowWhatsApp}
            onChange={(v) => onSettingsChange('allowWhatsApp', v)}
          />
        </SettingRow>
        <SettingRow label="Allow AirDrop">
          <Toggle
            checked={!!settings.allowAirDrop}
            onChange={(v) => onSettingsChange('allowAirDrop', v)}
          />
        </SettingRow>
        <SettingRow label="Allow Instagram">
          <Toggle
            checked={!!settings.allowInstagram}
            onChange={(v) => onSettingsChange('allowInstagram', v)}
          />
        </SettingRow>
      </Card>

      {/* ── 5. Guest Gallery & Selfie Face Match ── */}
      <Card title="🖼️ Guest Gallery & Selfie Match">
        <SettingRow label="Selfie Photo Finder (AI Face Match)">
          <Toggle
            checked={settings.allowSelfieSearch !== false}
            onChange={(v) => onSettingsChange('allowSelfieSearch', v)}
          />
        </SettingRow>
        <p className="text-white/40 text-xs -mt-2">
          Allows guests to snap a selfie after scanning the QR code to instantly filter and view only their photos.
        </p>

        <div className="h-px bg-white/10 my-2" />

        <p className="text-white/40 text-xs">
          Guests must enter this password to view the event gallery (leave blank for open access):
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={galleryPassword}
              onChange={(e) => setGalleryPassword(e.target.value)}
              placeholder="Leave blank for no password"
              className="w-full bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-xs transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSavePassword}
            disabled={savingPassword}
            className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {savingPassword ? 'Saving…' : 'Save Password'}
          </button>
          <button
            onClick={handleClearPassword}
            disabled={savingPassword}
            className="bg-white/10 hover:bg-red-500/20 border border-white/15 hover:border-red-500/30 text-white/60 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </Card>
    </div>
  );
}

export default PrintDeliveryHub;
