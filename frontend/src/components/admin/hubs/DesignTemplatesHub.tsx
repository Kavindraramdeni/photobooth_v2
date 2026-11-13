'use client';

import { useRef, useState } from 'react';
import { Palette, Image as ImageIcon, UploadCloud, X, RefreshCw, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { LiveKioskSimulator } from './LiveKioskSimulator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventShape {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface DesignTemplatesHubProps {
  event: EventShape;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  onBrandingChange: (key: string, value: unknown) => void;
  onSettingsChange: (key: string, value: unknown) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
  API_BASE: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const hexToLuma = (hex: string) => {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 0;
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

async function uploadAssetViaBackend(
  file: File,
  eventId: string,
  type: 'logo' | 'frame' | 'idle',
  API_BASE: string
): Promise<string> {
  const token = localStorage.getItem('sb_access_token');
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

// ── Compact Upload ─────────────────────────────────────────────────────────────

function CompactUpload({
  label,
  accept,
  currentUrl,
  onUploaded,
  eventId,
  assetType,
  API_BASE,
}: {
  label: string;
  accept: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
  eventId: string;
  assetType: 'logo' | 'frame' | 'idle';
  API_BASE: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAssetViaBackend(file, eventId, assetType, API_BASE);
      const cacheBusted =
        assetType === 'idle'
          ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`
          : url;
      onUploaded(cacheBusted);
      toast.success(`${label} uploaded!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  const fileName = currentUrl ? currentUrl.split('/').pop()?.split('?')[0] ?? label : null;

  return (
    <div className="flex items-center gap-2 w-full">
      <input ref={ref} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => !uploading && ref.current?.click()}
        disabled={uploading}
        className={`flex-1 h-9 flex items-center gap-2 px-3 rounded-lg border text-xs font-medium transition-all
          ${uploading
            ? 'bg-zinc-800/60 border-zinc-700 text-zinc-500 cursor-not-allowed'
            : currentUrl
            ? 'bg-zinc-800/60 border-zinc-700 hover:border-violet-500/60 text-zinc-300'
            : 'bg-zinc-800/60 border-zinc-700 hover:border-violet-500/60 text-zinc-400'
          }`}
      >
        {uploading ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400 shrink-0" />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">{fileName ?? label}</span>
          </>
        )}
      </button>
      {currentUrl && !uploading && (
        <button
          type="button"
          onClick={() => onUploaded('')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800/60 border border-zinc-700 hover:border-red-500/60 text-zinc-500 hover:text-red-400 transition-all"
          aria-label="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Save Bar ───────────────────────────────────────────────────────────────────

function SaveBar({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
}) {
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-xl shadow-xl">
      <p className="text-amber-300 text-sm font-medium">
        {saving ? 'Saving…' : 'You have unsaved changes'}
      </p>
      <button
        onClick={onSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
      >
        {saving ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </div>
  );
}

// ── Section Shell ──────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/50 border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-400" />
        <span className="text-white text-sm font-semibold">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-white/[0.03] last:border-0">
      {children}
    </div>
  );
}

function RowLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="shrink-0">
      <p className="text-sm text-zinc-200 font-medium">{label}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DesignTemplatesHub({
  event,
  branding,
  settings,
  onBrandingChange,
  onSave,
  saving,
  dirty,
  API_BASE,
}: DesignTemplatesHubProps) {
  const themeMode = String(branding['themeMode'] ?? 'light');
  const primaryColor = String(branding['primaryColor'] ?? '#7c3aed');
  const eventName = String(branding['eventName'] ?? event.name ?? 'SnapBooth AI');
  const footerText = String(branding['footerText'] ?? '');
  const logoUrl = String(branding['logoUrl'] ?? '');
  const wallpaperUrl = String(branding['wallpaperUrl'] ?? '');
  const idleMediaUrl = String(branding['idleMediaUrl'] ?? '');

  const isPrimaryTooLight = hexToLuma(primaryColor.length === 7 ? primaryColor : '#7c3aed') > 215;

  const colorInputRef = useRef<HTMLInputElement>(null);

  const THEMES = [
    { id: 'light', label: 'Light Studio', emoji: '☀️' },
    { id: 'dark', label: 'Dark Studio', emoji: '🌙' },
  ] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
      {/* ── LEFT: Settings Panel ── */}
      <div className="space-y-4">

        {/* Section 1 — Theme */}
        <Section icon={Sun} title="Theme">
          <Row>
            <RowLabel label="Theme Mode" sub="Controls booth color palette" />
            <div className="flex gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onBrandingChange('themeMode', t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    themeMode === t.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Section 2 — Brand */}
        <Section icon={Palette} title="Brand">
          {/* Primary Color */}
          <Row>
            <div className="shrink-0">
              <p className="text-sm text-zinc-200 font-medium">Primary Color</p>
              {isPrimaryTooLight && (
                <p className="text-xs text-amber-400 mt-0.5">⚠️ Low contrast</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Hidden native color picker */}
              <input
                ref={colorInputRef}
                type="color"
                value={primaryColor}
                onChange={(e) => onBrandingChange('primaryColor', e.target.value)}
                className="sr-only"
                aria-label="Pick primary color"
              />
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                className="w-7 h-7 rounded-md border-2 border-white/20 shrink-0 transition-shadow hover:shadow-md"
                style={{ backgroundColor: primaryColor }}
                aria-label="Open color picker"
              />
              <input
                type="text"
                value={primaryColor}
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onBrandingChange('primaryColor', v);
                }}
                className="w-24 bg-zinc-800/60 border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="#7c3aed"
              />
            </div>
          </Row>

          {/* Event Name */}
          <Row>
            <RowLabel label="Event Name" sub="Shown on idle screen" />
            <input
              type="text"
              value={eventName}
              onChange={(e) => onBrandingChange('eventName', e.target.value)}
              placeholder="Your Event Name"
              className="w-48 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </Row>

          {/* Footer Text */}
          <Row>
            <RowLabel label="Footer Text" sub="Shown on preview screen" />
            <input
              type="text"
              value={footerText}
              onChange={(e) => onBrandingChange('footerText', e.target.value)}
              placeholder="Powered by SnapBooth"
              className="w-48 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </Row>
        </Section>

        {/* Section 3 — Media */}
        <Section icon={ImageIcon} title="Media">
          {/* Logo */}
          <Row>
            <div className="flex items-center gap-2 shrink-0">
              {logoUrl && (
                <div className="w-10 h-10 rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                </div>
              )}
              <RowLabel label="Logo" sub="Shown on idle screen" />
            </div>
            <div className="flex-1 max-w-[220px]">
              <CompactUpload
                label="Upload logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                currentUrl={logoUrl}
                onUploaded={(url) => onBrandingChange('logoUrl', url)}
                eventId={event.id}
                assetType="logo"
                API_BASE={API_BASE}
              />
            </div>
          </Row>

          {/* Wallpaper */}
          <Row>
            <div className="shrink-0">
              <p className="text-sm text-zinc-200 font-medium">Wallpaper / Background</p>
              <p className="text-xs text-zinc-500 mt-0.5">Applies to booth background and idle attract screen.</p>
            </div>
            <div className="flex-1 max-w-[220px]">
              <CompactUpload
                label="Upload wallpaper"
                accept="image/png,image/jpeg,image/webp,video/mp4"
                currentUrl={wallpaperUrl}
                onUploaded={(url) => {
                  onBrandingChange('wallpaperUrl', url);
                  onBrandingChange('idleMediaUrl', url);
                }}
                eventId={event.id}
                assetType="idle"
                API_BASE={API_BASE}
              />
            </div>
          </Row>

          {/* Idle Attract Video */}
          <Row>
            <div className="shrink-0">
              <p className="text-sm text-zinc-200 font-medium">Idle Attract Video</p>
              <p className="text-xs text-zinc-500 mt-0.5">Loops on idle screen when no one is using the booth.</p>
            </div>
            <div className="flex-1 max-w-[220px]">
              <CompactUpload
                label="Upload idle media"
                accept="image/*,video/mp4"
                currentUrl={idleMediaUrl}
                onUploaded={(url) => onBrandingChange('idleMediaUrl', url)}
                eventId={event.id}
                assetType="idle"
                API_BASE={API_BASE}
              />
            </div>
          </Row>
        </Section>

        {/* Save Bar */}
        <SaveBar dirty={dirty} saving={saving} onSave={onSave} />
      </div>

      {/* ── RIGHT: Live Kiosk Simulator ── */}
      <div className="order-first lg:order-last">
        <LiveKioskSimulator
          branding={branding}
          settings={settings}
          eventName={eventName}
          slug={event.slug}
        />
      </div>
    </div>
  );
}

export default DesignTemplatesHub;
