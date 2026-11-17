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

  // ─── Calibration Grid Print ──────────────────────────────────────────────

  function handlePrintCalibrationGrid() {
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) {
      toast.error('Could not open calibration print window. Check pop-up blocker.');
      return;
    }
    const offX = Number(settings.printOffsetX ?? 0);
    const offY = Number(settings.printOffsetY ?? 0);
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Printer Alignment Calibration Grid — SnapBooth</title>
          <style>
            @page { size: 4in 6in portrait; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 4in; height: 6in; margin: 0; padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #fff; color: #000;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .grid-container {
              width: 100%; height: 100%;
              position: relative;
              border: 2px solid #000;
              transform: translate(${offX}mm, ${offY}mm);
            }
            .border-guide {
              position: absolute; inset: 5mm; border: 1px dashed #777;
            }
            .crosshair-h {
              position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #000;
            }
            .crosshair-v {
              position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #000;
            }
            .center-box {
              position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
              background: #fff; border: 1.5px solid #000; padding: 12px 16px; text-align: center;
              font-size: 11px; z-index: 10; border-radius: 6px;
            }
            .corner { position: absolute; font-size: 9px; font-weight: bold; }
            .tl { top: 8px; left: 8px; }
            .tr { top: 8px; right: 8px; text-align: right; }
            .bl { bottom: 8px; left: 8px; }
            .br { bottom: 8px; right: 8px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="grid-container">
            <div class="border-guide"></div>
            <div class="crosshair-h"></div>
            <div class="crosshair-v"></div>
            <div class="corner tl">⌜ TOP-LEFT<br>0mm, 0mm</div>
            <div class="corner tr">TOP-RIGHT ⌝<br>101.6mm, 0mm</div>
            <div class="corner bl">⌞ BOTTOM-LEFT<br>0mm, 152.4mm</div>
            <div class="corner br">BOTTOM-RIGHT ⌟<br>101.6mm, 152.4mm</div>
            <div class="center-box">
              <strong style="font-size: 13px;">SNAPBOOTH 4×6&Prime; CALIBRATION</strong><br>
              Current Offset: X = ${offX}mm | Y = ${offY}mm<br>
              <span style="font-size: 9px; color: #555;">Measure margins with ruler & adjust X/Y sliders in Admin</span>
            </div>
          </div>
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

        <div className="h-px bg-white/10 my-1" />

        {/* Printer Hardware Alignment Calibration */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm font-semibold">📐 Hardware Alignment Calibration</span>
            <span className="text-xs text-white/40">Fine-tune DNP/Citizen/Sinfonia feed</span>
          </div>

          <SettingRow label={`Horizontal Offset (X): ${Number(settings.printOffsetX ?? 0)} mm`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-10}
                max={10}
                step={0.5}
                value={Number(settings.printOffsetX ?? 0)}
                onChange={(e) => onSettingsChange('printOffsetX', Number(e.target.value))}
                className="w-32 accent-indigo-400"
              />
              <span className="w-12 text-center text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 py-0.5 rounded">
                {Number(settings.printOffsetX ?? 0)}mm
              </span>
            </div>
          </SettingRow>

          <SettingRow label={`Vertical Offset (Y): ${Number(settings.printOffsetY ?? 0)} mm`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-10}
                max={10}
                step={0.5}
                value={Number(settings.printOffsetY ?? 0)}
                onChange={(e) => onSettingsChange('printOffsetY', Number(e.target.value))}
                className="w-32 accent-indigo-400"
              />
              <span className="w-12 text-center text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 py-0.5 rounded">
                {Number(settings.printOffsetY ?? 0)}mm
              </span>
            </div>
          </SettingRow>
        </div>

        <div className="pt-2 flex flex-wrap gap-2">
          <button
            onClick={handleTestPrint}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            🖨️ Send Test Page
          </button>
          <button
            onClick={handlePrintCalibrationGrid}
            className="flex items-center gap-2 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            📐 Print Alignment Test Grid
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

        <SettingRow label="Allow WhatsApp Direct">
          <Toggle
            checked={!!settings.allowWhatsApp}
            onChange={(v) => onSettingsChange('allowWhatsApp', v)}
          />
        </SettingRow>

        {Boolean(settings.allowWhatsApp) && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3 -mt-1">
            <label className="flex flex-col gap-1">
              <span className="text-white/60 text-xs font-medium">WhatsApp Default Country Code</span>
              <input
                type="text"
                value={(settings.whatsappCountryCode as string) ?? '91'}
                onChange={(e) => onSettingsChange('whatsappCountryCode', e.target.value.replace(/\D/g, ''))}
                placeholder="91"
                className="w-32 bg-white/10 border border-white/15 text-white text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-white/40 text-[10px]">E.g. 91 (India), 1 (US/Canada), 44 (UK)</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-white/60 text-xs font-medium">Custom WhatsApp Message Template</span>
              <textarea
                rows={2}
                value={(settings.whatsappMessage as string) ?? ''}
                onChange={(e) => onSettingsChange('whatsappMessage', e.target.value)}
                placeholder="Here is your photo from {{eventName}}: {{photoUrl}}"
                className="w-full bg-white/10 border border-white/15 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/30 resize-none"
              />
              <span className="text-white/40 text-[10px]">Use &#123;&#123;eventName&#125;&#125; and &#123;&#123;photoUrl&#125;&#125; placeholders</span>
            </label>
          </div>
        )}

        <SettingRow label="Allow AirDrop (iOS Native Share)">
          <Toggle
            checked={!!settings.allowAirDrop}
            onChange={(v) => onSettingsChange('allowAirDrop', v)}
          />
        </SettingRow>
        {Boolean(settings.allowAirDrop) && (
          <p className="text-white/40 text-[11px] -mt-2">
            Invokes iOS Share Sheet with 4K JPEG file binary attached for instant AirDrop transfer to nearby iPhones/iPads.
          </p>
        )}

        <SettingRow label="Allow Instagram">
          <Toggle
            checked={!!settings.allowInstagram}
            onChange={(v) => onSettingsChange('allowInstagram', v)}
          />
        </SettingRow>
      </Card>

      {/* ── 5. Corporate Lead Capture & Survey ── */}
      <Card title="💼 Corporate Lead Capture & Survey">
        <SettingRow label="Enable Lead Capture & Survey">
          <PremiumToggle
            checked={Boolean(settings.enableLeadCapture)}
            onChange={(v) => onSettingsChange('enableLeadCapture', v)}
            label="PRO"
          />
        </SettingRow>
        <p className="text-white/40 text-xs -mt-2">
          Collect verified guest emails, phone numbers, and company info for corporate brand activations.
        </p>

        {Boolean(settings.enableLeadCapture) && (
          <div className="space-y-4 pt-2 border-t border-white/10">
            <SettingRow label="Gating Flow">
              <select
                value={(settings.leadGatingMode as string) || 'before_capture'}
                onChange={(e) => onSettingsChange('leadGatingMode', e.target.value)}
                className="bg-white/10 border border-white/15 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="before_capture">Before Capture (VIP Gate)</option>
                <option value="before_share">Before Sharing / Download</option>
              </select>
            </SettingRow>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={settings.leadRequireName !== false}
                  onChange={(e) => onSettingsChange('leadRequireName', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                />
                Require Full Name
              </label>

              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={settings.leadRequireEmail !== false}
                  onChange={(e) => onSettingsChange('leadRequireEmail', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                />
                Require Email Address
              </label>

              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={Boolean(settings.leadRequirePhone)}
                  onChange={(e) => onSettingsChange('leadRequirePhone', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                />
                Collect Phone Number
              </label>

              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={Boolean(settings.leadCollectCompany)}
                  onChange={(e) => onSettingsChange('leadCollectCompany', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                />
                Collect Company / Job Title
              </label>
            </div>

            <label className="flex flex-col gap-1 pt-1">
              <span className="text-white/50 text-xs">Custom Survey Question (Optional)</span>
              <input
                type="text"
                value={(settings.leadSurveyQuestion as string) || ''}
                onChange={(e) => onSettingsChange('leadSurveyQuestion', e.target.value)}
                placeholder="e.g. What product or service are you most interested in?"
                className="bg-white/8 border border-white/15 text-white text-xs rounded-lg px-3 py-2 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const token = getToken();
                  window.open(`${API_BASE}/api/leads/event/${event.id}/export?token=${token}`, '_blank');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                📊 Download Leads CSV (Excel)
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── 6. Guest Gallery & Selfie Face Match ── */}
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
