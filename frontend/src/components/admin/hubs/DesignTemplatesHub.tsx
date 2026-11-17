'use client';

import { useRef, useState } from 'react';
import { Palette, Image as ImageIcon, UploadCloud, X, RefreshCw, Sun, Moon, Sparkles, CircleDot, PlayCircle, Film, Check, LayoutTemplate, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { LiveKioskSimulator } from './LiveKioskSimulator';
import { TemplateCanvasDesigner } from './TemplateCanvasDesigner';
import {
  CARD_TEMPLATES_PORTRAIT,
  CARD_TEMPLATES_LANDSCAPE,
  getCardTemplateById,
  CardTemplate,
} from '@/lib/cardTemplates';

// ── Built-in Media Presets ────────────────────────────────────────────────────

export const BUILTIN_VIDEOS = [
  {
    id: 'landing-snapbooth',
    name: 'SnapBooth Attract Loop',
    desc: 'Official landing page motion demo',
    url: '/video/snapbooth.mp4',
    badge: 'Official',
  },
  {
    id: 'golden-bokeh',
    name: 'Golden Bokeh Gala',
    desc: 'Festive celebration sparkle lights',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-golden-bokeh-lights-background-41481-large.mp4',
    badge: 'Festive',
  },
  {
    id: 'neon-waves',
    name: 'Cyber Laser Club',
    desc: 'Vibrant neon rays & party glow',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-animation-41460-large.mp4',
    badge: 'Dynamic',
  },
];

export const BUILTIN_WALLPAPERS = [
  {
    id: 'automotive-stage',
    name: 'Neon Automotive Stage',
    desc: 'Luxury showroom stage with ambient lighting',
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1920&q=80',
    badge: 'Showcase',
  },
  {
    id: 'floral-abstract',
    name: 'Warm Floral Abstract',
    desc: 'LumaBooth signature warm botanical art',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80',
    badge: 'LumaBooth',
  },
  {
    id: 'midnight-gala',
    name: 'Midnight Gala Lights',
    desc: 'Warm celebratory golden bokeh',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1920&q=80',
    badge: 'Wedding',
  },
  {
    id: 'botanical-hedge',
    name: 'Botanical Greenery Wall',
    desc: 'Lush natural foliage hedge backdrop',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1920&q=80',
    badge: 'Nature',
  },
];

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
  const rawBgMode = String(branding['backgroundMode'] ?? '');
  const wallpaperUrl = String(branding['wallpaperUrl'] ?? '');
  const idleMediaUrl = String(branding['idleMediaUrl'] ?? '');
  const welcomeFlow = String(branding['welcomeFlow'] ?? 'floating');
  const glassmorphism = branding['glassmorphism'] !== false;
  const mediaUrl = wallpaperUrl || idleMediaUrl;
  const isVideoMedia = Boolean(mediaUrl?.match(/\.(mp4|webm|mov)(\?|$)/i));

  let currentBgMode: 'light' | 'dark' | 'video' | 'image' = 'dark';
  if (rawBgMode === 'light' || rawBgMode === 'dark' || rawBgMode === 'video' || rawBgMode === 'image') {
    currentBgMode = rawBgMode as any;
  } else if (themeMode === 'light') {
    currentBgMode = 'light';
  } else if (mediaUrl) {
    currentBgMode = isVideoMedia ? 'video' : 'image';
  }

  const isPrimaryTooLight = hexToLuma(primaryColor.length === 7 ? primaryColor : '#7c3aed') > 215;

  const colorInputRef = useRef<HTMLInputElement>(null);

  // 4x6 / 6x4 Card Templates State
  const cardOrientation = (branding['cardOrientation'] as 'portrait' | 'landscape') || 'portrait';
  const cardTemplateId = String(branding['cardTemplateId'] ?? 'indian-wedding-portrait');
  const [templateDesignerMode, setTemplateDesignerMode] = useState<'presets' | 'canvas'>(
    cardTemplateId === 'custom-canvas' ? 'canvas' : 'presets'
  );
  const frameUrl = String(branding['frameUrl'] ?? '');
  const templateHeadline = String(branding['templateHeadline'] ?? '');
  const templateSubtitle = String(branding['templateSubtitle'] ?? '');
  const templateNames = String(branding['templateNames'] ?? '');
  const templateDate = String(branding['templateDate'] ?? '');

  const activeTemplates = cardOrientation === 'landscape' ? CARD_TEMPLATES_LANDSCAPE : CARD_TEMPLATES_PORTRAIT;

  const handleSelectTemplate = (templateId: string) => {
    onBrandingChange('cardTemplateId', templateId);
    if (templateId === 'none') {
      onBrandingChange('frameUrl', '');
      return;
    }
    const tpl = getCardTemplateById(templateId);
    if (tpl) {
      onBrandingChange('cardOrientation', tpl.orientation);
      const svg = tpl.getOverlaySvg({
        headline: templateHeadline || tpl.headlineDefault,
        subtitle: templateSubtitle || tpl.subtitleDefault,
        names: templateNames,
        date: templateDate,
      });
      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      onBrandingChange('frameUrl', dataUri);
    }
  };

  const handleOrientationChange = (orient: 'portrait' | 'landscape') => {
    onBrandingChange('cardOrientation', orient);
    const defaultId = orient === 'portrait' ? 'indian-wedding-portrait' : 'indian-wedding-landscape';
    handleSelectTemplate(defaultId);
  };

  const handleUpdateTemplateText = (field: 'templateHeadline' | 'templateSubtitle' | 'templateNames' | 'templateDate', val: string) => {
    onBrandingChange(field, val);
    const tpl = getCardTemplateById(cardTemplateId);
    if (tpl) {
      const svg = tpl.getOverlaySvg({
        headline: field === 'templateHeadline' ? val : (templateHeadline || tpl.headlineDefault),
        subtitle: field === 'templateSubtitle' ? val : (templateSubtitle || tpl.subtitleDefault),
        names: field === 'templateNames' ? val : templateNames,
        date: field === 'templateDate' ? val : templateDate,
      });
      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      onBrandingChange('frameUrl', dataUri);
    }
  };

  const BG_MODES = [
    { id: 'light', label: 'White Studio', emoji: '☀️', desc: 'White theme, no media' },
    { id: 'dark', label: 'Dark Studio', emoji: '🌙', desc: 'Dark theme, no media' },
    { id: 'video', label: 'Playing Video', emoji: '🎬', desc: 'Ambient attract video' },
    { id: 'image', label: 'Background Image', emoji: '🖼️', desc: 'Custom wallpaper image' },
  ] as const;

  const handleSelectBgMode = (mode: 'light' | 'dark' | 'video' | 'image') => {
    onBrandingChange('backgroundMode', mode);
    onBrandingChange('themeMode', mode === 'light' ? 'light' : 'dark');
    if (mode === 'video' && (!mediaUrl || !isVideoMedia)) {
      onBrandingChange('idleMediaUrl', '/video/snapbooth.mp4');
      onBrandingChange('wallpaperUrl', '/video/snapbooth.mp4');
    } else if (mode === 'image' && (!mediaUrl || isVideoMedia)) {
      onBrandingChange('wallpaperUrl', BUILTIN_WALLPAPERS[0].url);
      onBrandingChange('idleMediaUrl', BUILTIN_WALLPAPERS[0].url);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] 2xl:grid-cols-[1fr_480px] gap-8 items-start">
      {/* ── LEFT: Settings Panel ── */}
      <div className="space-y-4 min-w-0">

        {/* Section 1 — Booth Background & Theme (Strictly Mutually Exclusive) */}
        <Section icon={Sun} title="Booth Background & Theme">
          <Row>
            <RowLabel
              label="Background Mode"
              sub="Exactly one active at a time: White, Dark, Playing Video, or Wallpaper Image."
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
              {BG_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectBgMode(m.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 text-center border ${
                    currentBgMode === m.id
                      ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                  }`}
                >
                  <span className="text-base">{m.emoji}</span>
                  <span className="leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Section 2 — Welcome Screen Flow & Liquid Glass Styling */}
        <Section icon={Sparkles} title="Welcome Screen Flow & Glass Styling">
          <Row>
            <RowLabel
              label="Kiosk Welcome Flow"
              sub="Select the kiosk idle screen experience style."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onBrandingChange('welcomeFlow', 'floating')}
                className={`p-3 rounded-2xl text-xs font-bold transition-all flex items-start gap-2.5 text-left border ${
                  welcomeFlow === 'floating'
                    ? 'bg-violet-600/20 text-white border-violet-500 shadow-md shadow-violet-600/20'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <CircleDot className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Option A: Floating Spheres</p>
                  <p className="text-[11px] text-zinc-400 font-normal mt-0.5">
                    Floating circular mode buttons directly on screen
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onBrandingChange('welcomeFlow', 'cinematic')}
                className={`p-3 rounded-2xl text-xs font-bold transition-all flex items-start gap-2.5 text-left border ${
                  welcomeFlow === 'cinematic'
                    ? 'bg-violet-600/20 text-white border-violet-500 shadow-md shadow-violet-600/20'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <PlayCircle className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Option B: Cinematic Hero</p>
                  <p className="text-[11px] text-zinc-400 font-normal mt-0.5">
                    Central &ldquo;Tap to Start&rdquo; ring leading to style selection cards
                  </p>
                </div>
              </button>
            </div>
          </Row>

          <Row>
            <RowLabel
              label="Liquid Glass Styling (Glassmorphism)"
              sub="Apple Vision Pro refractive frosted glass with specular rims and ambient blur."
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onBrandingChange('glassmorphism', !glassmorphism)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
                  glassmorphism ? 'bg-violet-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    glassmorphism ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-zinc-300">
                {glassmorphism ? 'Active (Liquid Glass)' : 'Flat Styling'}
              </span>
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

          {/* Mutually Exclusive Media Configuration based on currentBgMode */}
          {currentBgMode === 'image' && (
            <div className="space-y-4 pt-2">
              <Row>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-zinc-200 font-semibold">Built-in Wallpapers</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Select a curated event wallpaper or upload custom artwork below.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {BUILTIN_WALLPAPERS.map((wp) => {
                      const isSelected = wallpaperUrl === wp.url;
                      return (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => {
                            onBrandingChange('wallpaperUrl', wp.url);
                            onBrandingChange('idleMediaUrl', wp.url);
                          }}
                          className={`relative group rounded-2xl overflow-hidden border-2 text-left transition-all duration-200 aspect-[4/3] flex flex-col justify-end p-2.5 ${
                            isSelected
                              ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/20'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={wp.url}
                            alt={wp.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                          <div className="relative z-10">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-violet-300 bg-violet-950/70 px-1.5 py-0.5 rounded-full border border-violet-500/30 inline-block mb-1">
                              {wp.badge}
                            </span>
                            <p className="text-xs font-bold text-white truncate">{wp.name}</p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 border border-white flex items-center justify-center text-white z-20 shadow-md">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Row>

              <Row>
                <div className="shrink-0">
                  <p className="text-sm text-zinc-200 font-medium">Or Upload Custom Wallpaper</p>
                  <p className="text-xs text-zinc-500 mt-0.5">JPG, PNG, or WebP (1920×1080 recommended)</p>
                </div>
                <div className="flex-1 max-w-[240px]">
                  <CompactUpload
                    label="Upload custom image"
                    accept="image/png,image/jpeg,image/webp"
                    currentUrl={BUILTIN_WALLPAPERS.some(w => w.url === wallpaperUrl) ? '' : wallpaperUrl}
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
            </div>
          )}

          {currentBgMode === 'video' && (
            <div className="space-y-4 pt-2">
              <Row>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-zinc-200 font-semibold">Built-in Attract Videos</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Continuous looping motion backgrounds for the idle landing screen.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {BUILTIN_VIDEOS.map((vid) => {
                      const isSelected = (!idleMediaUrl && vid.id === 'landing-snapbooth') || idleMediaUrl === vid.url || wallpaperUrl === vid.url;
                      return (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => {
                            onBrandingChange('idleMediaUrl', vid.url);
                            onBrandingChange('wallpaperUrl', vid.url);
                          }}
                          className={`relative group rounded-2xl overflow-hidden border-2 text-left transition-all duration-200 p-3.5 backdrop-blur-xl ${
                            isSelected
                              ? 'bg-violet-600/20 border-violet-500 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/20'
                              : 'bg-zinc-800/40 border-white/10 hover:border-white/30 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300">
                              <Film className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-950/70 px-2 py-0.5 rounded-full border border-violet-500/30">
                              {vid.badge}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white mb-0.5">{vid.name}</p>
                          <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">{vid.desc}</p>
                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-violet-600 border border-white flex items-center justify-center text-white z-20 shadow-md">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Row>

              <Row>
                <div className="shrink-0">
                  <p className="text-sm text-zinc-200 font-medium">Or Upload Custom Attract Video</p>
                  <p className="text-xs text-zinc-500 mt-0.5">MP4, WebM, or MOV loop (up to 50MB)</p>
                </div>
                <div className="flex-1 max-w-[240px]">
                  <CompactUpload
                    label="Upload custom video"
                    accept="video/mp4,video/webm,video/quicktime"
                    currentUrl={BUILTIN_VIDEOS.some(v => v.url === idleMediaUrl) ? '' : idleMediaUrl}
                    onUploaded={(url) => {
                      onBrandingChange('idleMediaUrl', url);
                      onBrandingChange('wallpaperUrl', url);
                    }}
                    eventId={event.id}
                    assetType="idle"
                    API_BASE={API_BASE}
                  />
                </div>
              </Row>
            </div>
          )}

          {(currentBgMode === 'light' || currentBgMode === 'dark') && (
            <div className="p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl text-xs text-zinc-400 flex items-center gap-2.5">
              <span className="text-base">{currentBgMode === 'light' ? '☀️' : '🌙'}</span>
              <span>
                <strong>{currentBgMode === 'light' ? 'White Studio' : 'Dark Studio'} active:</strong> Background image and video are disabled for a pure, distraction-free studio backdrop.
              </span>
            </div>
          )}
        </Section>

        {/* Section 4 — 4×6 Commemorative Print Card Templates & Overlays */}
        <Section icon={LayoutTemplate} title="4×6 Print Card Templates & Overlays">
          {/* Paper Calibration & Format Notice */}
          <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-xl text-xs text-violet-200 flex items-start gap-2.5">
            <Printer className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-white">4×6 Paper Print Calibration</p>
              <p className="text-zinc-400 leading-relaxed">
                The guest photo is placed directly in the center window with edge blending. Saves both the branded 4×6 print card and the clean raw photo to the gallery.
              </p>
            </div>
          </div>

          {/* Designer Mode Switcher: Presets vs Visual Canvas Designer */}
          <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-white/10 text-xs font-bold w-fit">
            <button
              type="button"
              onClick={() => setTemplateDesignerMode('presets')}
              className={`px-4 py-2 rounded-lg transition-all ${
                templateDesignerMode === 'presets'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎨 Curated 4×6 Presets &amp; Upload
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateDesignerMode('canvas');
                onBrandingChange('cardTemplateId', 'custom-canvas');
              }}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                templateDesignerMode === 'canvas'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Visual Drag &amp; Drop Designer
            </button>
          </div>

          {templateDesignerMode === 'canvas' ? (
            <div className="pt-2">
              <TemplateCanvasDesigner
                branding={branding}
                onBrandingChange={onBrandingChange}
                onSave={onSave}
                saving={saving}
              />
            </div>
          ) : (
            <>
          {/* Orientation Switcher: Portrait 4x6 vs Landscape 6x4 */}
          <Row>
            <RowLabel
              label="Card Orientation"
              sub="Portrait (1200×1800) for couples/solos vs Landscape (1800×1200) for wide family groups"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOrientationChange('portrait')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  cardOrientation === 'portrait'
                    ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                }`}
              >
                📱 Portrait 4×6
              </button>
              <button
                type="button"
                onClick={() => handleOrientationChange('landscape')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  cardOrientation === 'landscape'
                    ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                }`}
              >
                🖥️ Landscape 6×4
              </button>
            </div>
          </Row>

          {/* Inbuilt Templates Grid for active orientation */}
          <Row>
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-zinc-200 font-semibold">
                    {cardOrientation === 'portrait' ? 'Portrait 4×6 Presets' : 'Landscape 6×4 Presets'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Select a curated card template or upload a custom Canva/Photoshop transparent PNG below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. None / Full Bleed Option */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('none')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    cardTemplateId === 'none'
                      ? 'bg-violet-600/20 border-violet-500 ring-2 ring-violet-500/30 shadow-lg'
                      : 'bg-zinc-800/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                      Standard
                    </span>
                    {cardTemplateId === 'none' && (
                      <div className="w-5 h-5 rounded-full bg-violet-600 border border-white flex items-center justify-center text-white shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="font-bold text-xs text-white">None (Full-Bleed 4×6)</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Pure edge-to-edge camera capture without commemorative card graphics.</p>
                </button>

                {/* 2. Curated Presets for Current Orientation */}
                {activeTemplates.map((t) => {
                  const isSelected = cardTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(t.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-violet-600/20 border-violet-500 ring-2 ring-violet-500/30 shadow-lg'
                          : 'bg-zinc-800/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-500/30">
                          {t.badge}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-violet-600 border border-white flex items-center justify-center text-white shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-xs text-white">{t.name}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </Row>

          {/* Custom Upload 4x6 / 6x4 PNG */}
          <Row>
            <div className="shrink-0">
              <p className="text-sm text-zinc-200 font-medium">Or Upload Custom Card Frame</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Transparent PNG from Canva / Photoshop ({cardOrientation === 'portrait' ? '1200×1800 px' : '1800×1200 px'})
              </p>
            </div>
            <div className="flex-1 max-w-[240px]">
              <CompactUpload
                label="Upload 4×6 PNG"
                accept="image/png"
                currentUrl={cardTemplateId === 'custom' ? frameUrl : ''}
                onUploaded={(url) => {
                  onBrandingChange('cardTemplateId', 'custom');
                  onBrandingChange('frameUrl', url);
                }}
                eventId={event.id}
                assetType="frame"
                API_BASE={API_BASE}
              />
            </div>
          </Row>

          {/* Dynamic Template Text Inputs (for easily editing names/dates on built-in cards) */}
          {cardTemplateId !== 'none' && cardTemplateId !== 'custom' && (
            <div className="pt-2 border-t border-white/[0.04] space-y-3">
              <p className="text-xs font-semibold text-zinc-300">
                ✏️ Customize Card Text (Optional — leaves default if blank)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Couple / Host Names</label>
                  <input
                    type="text"
                    value={templateNames}
                    onChange={(e) => handleUpdateTemplateText('templateNames', e.target.value)}
                    placeholder="e.g. Rahul & Priya"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Event Date & City</label>
                  <input
                    type="text"
                    value={templateDate}
                    onChange={(e) => handleUpdateTemplateText('templateDate', e.target.value)}
                    placeholder="e.g. 18 November 2026 • Hyderabad"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] text-zinc-400 block mb-1">Headline Text</label>
                  <input
                    type="text"
                    value={templateHeadline}
                    onChange={(e) => handleUpdateTemplateText('templateHeadline', e.target.value)}
                    placeholder="Thank You for Attending Our Wedding"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </Section>

        {/* Save Bar */}
        <SaveBar dirty={dirty} saving={saving} onSave={onSave} />
      </div>

      {/* ── RIGHT: Live Kiosk Simulator ── */}
      <div className="order-first xl:order-last min-w-0 w-full flex justify-center">
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
