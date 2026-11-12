'use client';

import { useRef, useState } from 'react';
import {
  Palette, Image as ImageIcon, Upload, UploadCloud, X, RefreshCw,
  Sparkles, Film, ExternalLink, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FramesManager } from '@/components/admin/FramesManager';
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

interface Frame {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  isActive: boolean;
}

interface AIStyle {
  id: string;
  style_key: string;
  name: string;
  emoji: string;
  prompt: string;
  preview_image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Shared micro-components ───────────────────────────────────────────────────

function PremiumToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
        checked ? 'bg-violet-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
      {children}
    </label>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass-panel border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl transition-all ${className}`}
    >
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-white font-bold text-sm flex items-center gap-2.5">
            {Icon && <Icon className="w-4 h-4 text-purple-400" />}
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/40 text-xs mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({
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

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
      />
      <div
        onClick={() => !uploading && ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center gap-2 ${
          uploading
            ? 'border-zinc-700 bg-zinc-900/30 opacity-50 cursor-not-allowed'
            : 'border-zinc-700 hover:border-violet-500 hover:bg-violet-500/5 bg-zinc-900/30 cursor-pointer'
        }`}
      >
        <UploadCloud
          className={`w-5 h-5 ${
            uploading ? 'text-zinc-600 animate-bounce' : 'text-violet-400'
          }`}
        />
        <span className="text-sm font-medium text-zinc-300">
          {uploading ? 'Uploading…' : `Upload ${label}`}
        </span>
        <span className="text-xs text-zinc-600">PNG, JPG, MP4 supported</span>
      </div>
      {currentUrl && (
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
          <p className="text-zinc-400 text-xs truncate max-w-[200px]">
            {currentUrl.split('/').pop()}
          </p>
          <button
            onClick={() => onUploaded('')}
            className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs ml-2 flex-shrink-0"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Brand Identity Card ────────────────────────────────────────────────────────

function BrandIdentityCard({
  branding,
  onBrandingChange,
  event,
  API_BASE,
}: {
  branding: Record<string, unknown>;
  onBrandingChange: (key: string, value: unknown) => void;
  event: EventShape;
  API_BASE: string;
}) {
  const primaryColor = String(branding['primaryColor'] ?? '#7c3aed');
  const secondaryColor = String(branding['secondaryColor'] ?? '#a78bfa');
  const themeMode = String(branding['themeMode'] ?? 'light');
  const wallpaperUrl = String(branding['wallpaperUrl'] ?? '');
  const logoUrl = String(branding['logoUrl'] ?? '');
  const footerText = String(branding['footerText'] ?? '');
  const overlayText = String(branding['overlayText'] ?? '');
  const showDate = Boolean(branding['showDate'] ?? false);

  // Simple luminosity check to alert on low contrast
  const hexToLuma = (hex: string) => {
    const c = hex.replace('#', '');
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const isPrimaryTooLight = hexToLuma(primaryColor.length === 7 ? primaryColor : '#7c3aed') > 215;

  return (
    <Card
      title="Brand Identity & Atmosphere"
      subtitle="Theme mode, universal wallpaper, colors, and logo"
      icon={Palette}
    >
      <div className="space-y-6">
        {/* Theme Mode Selector */}
        <div>
          <FieldLabel>Kiosk Canvas Theme</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'light', name: 'Apple Light Studio', desc: 'Crisp white, soft silver crystal glass', icon: '☀️' },
              { id: 'dark', name: 'Dark Luxury Obsidian', desc: 'Midnight black with neon glows', icon: '🌙' },
              { id: 'champagne', name: 'Champagne Gold', desc: 'Warm wedding luxury palette', icon: '🥂' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onBrandingChange('themeMode', t.id)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  themeMode === t.id
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/30'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <span className="text-xl mb-1 block">{t.icon}</span>
                <p className="text-white font-bold text-xs">{t.name}</p>
                <p className="text-white/40 text-[10px] mt-0.5 leading-relaxed">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Universal Wallpaper Background */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel>Universal Event Wallpaper (All Screens)</FieldLabel>
            <span className="text-[10px] text-purple-400 font-semibold">Visible across booth &amp; guest screens</span>
          </div>
          <UploadZone
            label="Event Wallpaper"
            accept="image/png,image/jpeg,image/webp,video/mp4"
            currentUrl={wallpaperUrl}
            onUploaded={(url) => {
              onBrandingChange('wallpaperUrl', url);
              if (!branding['idleMediaUrl']) {
                onBrandingChange('idleMediaUrl', url);
              }
            }}
            eventId={event.id}
            assetType="idle"
            API_BASE={API_BASE}
          />
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Colours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Primary Color */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Primary Accent Color</FieldLabel>
              {isPrimaryTooLight && (
                <span className="text-[10px] text-amber-400 font-bold">⚠️ Low contrast on white</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <label className="relative cursor-pointer flex-shrink-0">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => onBrandingChange('primaryColor', e.target.value)}
                  className="sr-only"
                />
                <div
                  className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-md transition-shadow hover:shadow-purple-500/30"
                  style={{ backgroundColor: primaryColor }}
                />
              </label>
              <input
                type="text"
                value={primaryColor}
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onBrandingChange('primaryColor', v);
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-purple-400 transition-colors"
                placeholder="#7c3aed"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <FieldLabel>Secondary Accent Color</FieldLabel>
            <div className="flex gap-2 items-center">
              <label className="relative cursor-pointer flex-shrink-0">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => onBrandingChange('secondaryColor', e.target.value)}
                  className="sr-only"
                />
                <div
                  className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-md transition-shadow hover:shadow-purple-500/30"
                  style={{ backgroundColor: secondaryColor }}
                />
              </label>
              <input
                type="text"
                value={secondaryColor}
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onBrandingChange('secondaryColor', v);
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-purple-400 transition-colors"
                placeholder="#a78bfa"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* Logo */}
        <div>
          <FieldLabel>Event Logo</FieldLabel>
          <div className="flex gap-4 items-start">
            <UploadZone
              label="Logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              currentUrl={logoUrl}
              onUploaded={(url) => onBrandingChange('logoUrl', url)}
              eventId={event.id}
              assetType="logo"
              API_BASE={API_BASE}
            />
            {logoUrl && (
              <div className="flex-shrink-0 w-20 h-20 rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden flex items-center justify-center">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="w-full h-full object-contain p-1"
                />
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* Text fields */}
        <div className="space-y-4">
          <div>
            <FieldLabel>Footer Text</FieldLabel>
            <input
              type="text"
              value={footerText}
              onChange={(e) => onBrandingChange('footerText', e.target.value)}
              placeholder="Powered by SnapBooth"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <FieldLabel>Overlay Text</FieldLabel>
            <input
              type="text"
              value={overlayText}
              onChange={(e) => onBrandingChange('overlayText', e.target.value)}
              placeholder="e.g. #WeddingOf2025"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* Show Date */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium">Show Date on Photo</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Print the event date in the photo footer
            </p>
          </div>
          <PremiumToggle
            checked={showDate}
            onChange={(v) => onBrandingChange('showDate', v)}
          />
        </div>
      </div>
    </Card>
  );
}

// ── Photo Template Card ────────────────────────────────────────────────────────

interface TemplateOption {
  key: string;
  emoji: string;
  name: string;
  desc: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    key: 'classic',
    emoji: '🖼️',
    name: 'Classic',
    desc: 'Standard framed photo with clean borders',
  },
  {
    key: 'polaroid',
    emoji: '📷',
    name: 'Polaroid',
    desc: 'White border with handwritten-style caption',
  },
  {
    key: 'strip',
    emoji: '🎞️',
    name: 'Strip',
    desc: '4-shot vertical strip with consistent framing',
  },
];

function PhotoTemplateCard({
  branding,
  onBrandingChange,
}: {
  branding: Record<string, unknown>;
  onBrandingChange: (key: string, value: unknown) => void;
}) {
  const selected = String(branding['template'] ?? 'classic');

  return (
    <Card
      title="Photo Template"
      subtitle="Choose the layout and style for guest photos"
      icon={ImageIcon}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TEMPLATE_OPTIONS.map((tpl) => {
          const isSelected = selected === tpl.key;
          return (
            <button
              key={tpl.key}
              onClick={() => onBrandingChange('template', tpl.key)}
              className={`group flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all duration-200 ${
                isSelected
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/60'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform duration-200 ${
                  isSelected ? 'scale-110' : 'group-hover:scale-105'
                } ${isSelected ? 'bg-violet-500/20' : 'bg-zinc-800'}`}
              >
                {tpl.emoji}
              </div>
              <div>
                <p
                  className={`font-semibold text-sm ${
                    isSelected ? 'text-violet-300' : 'text-zinc-200'
                  }`}
                >
                  {tpl.name}
                </p>
                <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{tpl.desc}</p>
              </div>
              {isSelected && (
                <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Idle Attract Screen Card ───────────────────────────────────────────────────

function IdleAttractCard({
  branding,
  onBrandingChange,
  event,
  API_BASE,
}: {
  branding: Record<string, unknown>;
  onBrandingChange: (key: string, value: unknown) => void;
  event: EventShape;
  API_BASE: string;
}) {
  const idleMediaUrl = String(branding['idleMediaUrl'] ?? '');

  return (
    <Card
      title="Idle Attract Screen"
      subtitle="Displays on the booth screen when no one is using it"
      icon={Film}
    >
      <div className="space-y-4">
        <UploadZone
          label="Idle Media"
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4"
          currentUrl={idleMediaUrl}
          onUploaded={(url) => onBrandingChange('idleMediaUrl', url)}
          eventId={event.id}
          assetType="idle"
          API_BASE={API_BASE}
        />
        {idleMediaUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800 aspect-video bg-zinc-900">
            {idleMediaUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
              <video
                src={idleMediaUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={idleMediaUrl}
                alt="Idle attract preview"
                className="w-full h-full object-cover"
              />
            )}
          </div>
        )}
        <p className="text-zinc-600 text-xs">
          Recommended: landscape MP4 or high-res JPG/PNG. Max 50 MB.
        </p>
      </div>
    </Card>
  );
}

// ── Frame Overlays Card ────────────────────────────────────────────────────────

function FrameOverlaysCard({ event }: { event: EventShape }) {
  // FramesManager needs eventId, frames, and onFramesUpdate.
  // The hub manages its own local frames state so FramesManager can be used standalone.
  const [frames, setFrames] = useState<Frame[]>([]);

  return (
    <Card
      title="Frame Overlays"
      subtitle="Upload PNG frames that guests can apply during photo preview"
      icon={ImageIcon}
    >
      <FramesManager
        eventId={event.id}
        frames={frames}
        onFramesUpdate={setFrames}
      />
    </Card>
  );
}

// ── AI Art Styles Card ─────────────────────────────────────────────────────────

function AIArtStylesCard({
  event,
  API_BASE,
}: {
  event: EventShape;
  API_BASE: string;
}) {
  const [styles, setStyles] = useState<AIStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function fetchStyles() {
    if (loading || loaded) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const res = await fetch(`${API_BASE}/api/ai/event-styles/${event.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load styles');
      const data = await res.json();
      setStyles(data.styles ?? []);
      setLoaded(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load AI styles');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title="AI Art Styles"
      subtitle="Configure which AI transformation styles guests can choose"
      icon={Sparkles}
    >
      <div className="space-y-5">
        <p className="text-zinc-400 text-sm leading-relaxed">
          AI Art mode transforms guest photos using generative AI style presets. Each style
          applies a distinct artistic filter — anime, cyberpunk, oil painting, and more.
        </p>

        {!loaded ? (
          <button
            onClick={fetchStyles}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading styles…
              </>
            ) : (
              <>
                <Hash className="w-4 h-4" />
                Load configured styles
              </>
            )}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-zinc-500 text-xs font-medium">
                {styles.length} style{styles.length !== 1 ? 's' : ''} configured
              </span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>

            {styles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {styles.map((s) => (
                  <div
                    key={s.id}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-opacity ${
                      s.is_active
                        ? 'border-zinc-700 bg-zinc-900/50'
                        : 'border-zinc-800 bg-zinc-900/20 opacity-50'
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <p className="text-zinc-200 text-xs font-semibold">{s.name}</p>
                    {!s.is_active && (
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        Hidden
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {styles.length === 0 && (
              <div className="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center">
                <Sparkles className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No custom styles yet</p>
                <p className="text-zinc-600 text-xs mt-1">
                  Global defaults will be used in the booth
                </p>
              </div>
            )}

            <button
              onClick={fetchStyles}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </>
        )}

        <a
          href={`/admin/events/${event.id}?tab=aistyles`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 justify-center w-full border border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/5 text-zinc-300 hover:text-violet-300 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Manage AI Styles
        </a>
      </div>
    </Card>
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
    <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-3.5 backdrop-blur-xl shadow-xl">
      <p className="text-amber-300 text-sm font-medium">
        {saving ? 'Saving…' : 'You have unsaved changes'}
      </p>
      <button
        onClick={onSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
      >
        {saving ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DesignTemplatesHub({
  event,
  branding,
  settings,
  onBrandingChange,
  onSettingsChange,
  onSave,
  saving,
  dirty,
  API_BASE,
}: DesignTemplatesHubProps) {
  const eventName = String(branding['eventName'] ?? event.name ?? 'SnapBooth AI');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT: Controls (7 cols on lg, full on mobile) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Brand Identity */}
        <BrandIdentityCard
          branding={branding}
          onBrandingChange={onBrandingChange}
          event={event}
          API_BASE={API_BASE}
        />

        {/* Photo Template */}
        <PhotoTemplateCard branding={branding} onBrandingChange={onBrandingChange} />

        {/* Idle Attract Screen */}
        <IdleAttractCard
          branding={branding}
          onBrandingChange={onBrandingChange}
          event={event}
          API_BASE={API_BASE}
        />

        {/* Frame Overlays */}
        <FrameOverlaysCard event={event} />

        {/* AI Art Styles */}
        <AIArtStylesCard event={event} API_BASE={API_BASE} />

        {/* Save Bar */}
        <SaveBar dirty={dirty} saving={saving} onSave={onSave} />
      </div>

      {/* RIGHT: Live Kiosk Simulator (5 cols on lg, sticky on desktop) */}
      <div className="lg:col-span-5 order-first lg:order-last">
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
