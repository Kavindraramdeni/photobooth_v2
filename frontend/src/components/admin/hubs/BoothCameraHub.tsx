'use client';

import {
  Camera, RefreshCw, Sparkles,
  Volume2, FlipHorizontal, RotateCcw,
  Clock, Tablet, Wand2, Crown, Glasses,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoothCameraHubProps {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
  eventId: string;
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function PremiumToggle({
  checked,
  onChange,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-violet-600'
          : checked
          ? 'bg-violet-600 cursor-pointer'
          : 'bg-zinc-700 cursor-pointer'
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
      className={`bg-zinc-900/40 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-violet-400" />}
            {title}
          </h3>
          {subtitle && (
            <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
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
          {desc && (
            <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
          )}
        </div>
      </div>
      <PremiumToggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Capture Mode Card ──────────────────────────────────────────────────────────

interface CaptureMode {
  key: string;
  icon: string;
  name: string;
  desc: string;
  alwaysOn?: boolean;
}

const CAPTURE_MODES: CaptureMode[] = [
  {
    key: 'singlePhoto',
    icon: '📸',
    name: 'Single Photo',
    desc: 'Standard single-shot capture',
    alwaysOn: true,
  },
  {
    key: 'allowStrip',
    icon: '📽️',
    name: 'Photo Strip',
    desc: '4 sequential shots in a strip',
  },
  {
    key: 'allowGIF',
    icon: '🌀',
    name: 'GIF',
    desc: 'Animated GIF from burst shots',
  },
  {
    key: 'allowBoomerang',
    icon: '🔄',
    name: 'Boomerang',
    desc: 'Looping back-and-forth effect',
  },
  {
    key: 'allowAI',
    icon: '🤖',
    name: 'AI Art',
    desc: 'AI style transformation',
  },
];

function CaptureModeCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  return (
    <Card
      title="Capture Modes"
      subtitle="Choose which photo modes are available to guests"
      icon={Camera}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {CAPTURE_MODES.map((mode) => {
          const isOn = mode.alwaysOn || Boolean(settings[mode.key]);
          return (
            <div
              key={mode.key}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-all ${
                isOn
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl leading-none">{mode.icon}</div>
                {mode.alwaysOn ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Always On
                  </span>
                ) : (
                  <PremiumToggle
                    checked={Boolean(settings[mode.key])}
                    onChange={(v) => onSettingsChange(mode.key, v)}
                  />
                )}
              </div>
              <div>
                <p className="text-zinc-200 text-sm font-semibold">{mode.name}</p>
                <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{mode.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Camera Settings Card ───────────────────────────────────────────────────────

function CameraSettingsCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  const countdownSeconds = Number(settings['countdownSeconds'] ?? 3);
  const retakeLimit = String(settings['retakeLimit'] ?? '0');
  const displayOrientation = String(settings['displayOrientation'] ?? 'auto');
  const countdownSound = Boolean(settings['countdownSound'] ?? true);
  const mirrorVideo = Boolean(settings['mirrorVideo'] ?? true);
  const allowRetakes = Boolean(settings['allowRetakes'] ?? true);

  return (
    <Card
      title="Camera Settings"
      subtitle="Configure camera behaviour and session controls"
      icon={Camera}
    >
      <div className="space-y-6">
        {/* Countdown Timer */}
        <div>
          <FieldLabel>Countdown Timer</FieldLabel>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={10}
              value={countdownSeconds}
              onChange={(e) =>
                onSettingsChange(
                  'countdownSeconds',
                  Math.min(10, Math.max(1, Number(e.target.value)))
                )
              }
              className="w-24 bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors text-center"
            />
            <span className="text-zinc-400 text-sm">seconds (1–10)</span>
          </div>
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* Toggles */}
        <div className="space-y-4">
          <ToggleRow
            icon={Volume2}
            label="Countdown Sound"
            desc="Play an audio beep during countdown"
            checked={countdownSound}
            onChange={(v) => onSettingsChange('countdownSound', v)}
          />
          <ToggleRow
            icon={FlipHorizontal}
            label="Mirror Video"
            desc="Flip camera preview horizontally (like a selfie mirror)"
            checked={mirrorVideo}
            onChange={(v) => onSettingsChange('mirrorVideo', v)}
          />
          <ToggleRow
            icon={RotateCcw}
            label="Allow Retakes"
            desc="Let guests retake their photo before saving"
            checked={allowRetakes}
            onChange={(v) => onSettingsChange('allowRetakes', v)}
          />
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* Display Orientation */}
        <div>
          <FieldLabel>Display Orientation</FieldLabel>
          <select
            value={displayOrientation}
            onChange={(e) => onSettingsChange('displayOrientation', e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="auto">Auto</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>

        {/* Retake Limit */}
        {allowRetakes && (
          <div>
            <FieldLabel>Retake Limit</FieldLabel>
            <select
              value={retakeLimit}
              onChange={(e) => onSettingsChange('retakeLimit', e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="0">Unlimited</option>
              <option value="1">1 retake</option>
              <option value="2">2 retakes</option>
              <option value="3">3 retakes</option>
            </select>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Beauty Mode Card ───────────────────────────────────────────────────────────

function getBeautyLabel(level: number): { name: string; color: string } {
  if (level === 0) return { name: 'Off', color: 'text-zinc-500' };
  if (level <= 3) return { name: 'Light', color: 'text-emerald-400' };
  if (level <= 7) return { name: 'Medium', color: 'text-amber-400' };
  return { name: 'Heavy', color: 'text-pink-400' };
}

function BeautyModeCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  const beautyLevel = Number(settings['beautyLevel'] ?? 0);
  const { name, color } = getBeautyLabel(beautyLevel);

  return (
    <Card
      title="Beauty Mode"
      subtitle="Apply real-time facial smoothing to the camera preview"
      icon={Sparkles}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium">Smoothing Level</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              0 = Off, 1–3 = Light, 4–7 = Medium, 8–10 = Heavy
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">{beautyLevel}</span>
            <p className={`text-xs font-semibold mt-0.5 ${color}`}>{name}</p>
          </div>
        </div>

        <div className="relative">
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={beautyLevel}
            onChange={(e) => onSettingsChange('beautyLevel', Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500 bg-zinc-800"
          />
          <div className="flex justify-between mt-2 px-0.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span
                key={n}
                className={`text-[10px] font-medium transition-colors ${
                  n === beautyLevel ? 'text-violet-400' : 'text-zinc-700'
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Visual indicator bar */}
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-pink-500 transition-all duration-300"
            style={{ width: `${beautyLevel * 10}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

// ── Celebrity Glam Card ───────────────────────────────────────────────────────

function CelebrityGlamCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  const glamMode = String(settings['glamMode'] ?? 'off');
  const glamIntensity = Number(settings['glamIntensity'] ?? 8);

  return (
    <Card
      title="Celebrity Glam Filter"
      subtitle="Hollywood porcelain skin-smoothing with signature Kardashian high-contrast monochrome"
      icon={Wand2}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel>Glam Filter Preset</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'off', label: 'Disabled', desc: 'Standard colors' },
              { id: 'kardashian_bw', label: 'Kardashian B&W', desc: 'High-contrast monochrome' },
              { id: 'hollywood_glow', label: 'Hollywood Glow', desc: 'Luminous warm champagne' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSettingsChange('glamMode', preset.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  glamMode === preset.id
                    ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg'
                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <p className="font-bold text-xs text-white">{preset.label}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{preset.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {glamMode !== 'off' && (
          <div className="pt-2 border-t border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 text-xs font-medium">Porcelain Smoothing Intensity</span>
              <span className="text-violet-400 text-xs font-bold">{glamIntensity} / 10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={glamIntensity}
              onChange={(e) => onSettingsChange('glamIntensity', Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500 bg-zinc-800"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

// ── AR Digital Props Card ─────────────────────────────────────────────────────

function DigitalPropsCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  const enableDigitalProps = Boolean(settings['enableDigitalProps'] ?? true);
  const activePack = String(settings['digitalPropsPack'] ?? 'party');

  return (
    <Card
      title="AR Digital Props & Stickers"
      subtitle="Interactive face sunglasses, crowns, hats, and party stickers for guests"
      icon={Crown}
    >
      <div className="space-y-5">
        <ToggleRow
          icon={Glasses}
          label="Enable Live Digital Props"
          desc="Show on-screen touch props dock during camera countdown and preview"
          checked={enableDigitalProps}
          onChange={(v) => onSettingsChange('enableDigitalProps', v)}
        />

        {enableDigitalProps && (
          <div className="pt-2 border-t border-white/[0.04] space-y-2">
            <FieldLabel>Active Prop Collection</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'party', name: 'Party & Celebration', desc: 'Party hats, shades, mustaches' },
                { id: 'wedding', name: 'Wedding Elegance', desc: 'Floral crowns, tiaras, champagne' },
                { id: 'retro', name: 'Retro & VIP', desc: 'Aviators, gold chains, sparkles' },
              ].map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => onSettingsChange('digitalPropsPack', pack.id)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    activePack === pack.id
                      ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <p className="font-bold text-xs text-white">{pack.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{pack.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Session Settings Card ──────────────────────────────────────────────────────

function SessionSettingsCard({
  settings,
  onSettingsChange,
}: {
  settings: Record<string, unknown>;
  onSettingsChange: (key: string, value: unknown) => void;
}) {
  const shareScreenTimeout = Number(settings['shareScreenTimeout'] ?? 30);
  const roamingMode = Boolean(settings['roamingMode'] ?? false);

  return (
    <Card
      title="Session Settings"
      subtitle="Control idle timeouts and booth deployment mode"
      icon={Clock}
    >
      <div className="space-y-6">
        <div>
          <FieldLabel>Share Screen Timeout</FieldLabel>
          <div className="grid grid-cols-5 gap-2">
            {[10, 15, 20, 30, 60].map((s) => (
              <button
                key={s}
                onClick={() => onSettingsChange('shareScreenTimeout', s)}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  shareScreenTimeout === s
                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
          <p className="text-zinc-600 text-xs mt-2">
            After this many seconds on the share screen, the booth returns to attract mode
          </p>
        </div>

        <div className="h-px bg-white/[0.04]" />

        <ToggleRow
          icon={Tablet}
          label="Roaming Mode"
          desc="Tablet-mounted camera walks the venue — optimised for handheld use"
          checked={roamingMode}
          onChange={(v) => onSettingsChange('roamingMode', v)}
        />

        <div className="h-px bg-white/[0.04]" />

        <ToggleRow
          icon={Sparkles}
          label="Selfie Photo Finder (AI Face Match)"
          desc="Guests can snap a selfie in the gallery to instantly view only their photos"
          checked={Boolean(settings['allowSelfieSearch'] ?? true)}
          onChange={(v) => onSettingsChange('allowSelfieSearch', v)}
        />
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

export function BoothCameraHub({
  settings,
  onSettingsChange,
  onSave,
  saving,
  dirty,
}: BoothCameraHubProps) {
  return (
    <div className="space-y-6">
      {/* Capture Modes */}
      <CaptureModeCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* Camera Settings */}
      <CameraSettingsCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* Beauty Mode */}
      <BeautyModeCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* Celebrity Glam Mode */}
      <CelebrityGlamCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* AR Digital Props & Stickers */}
      <DigitalPropsCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* Session Settings */}
      <SessionSettingsCard settings={settings} onSettingsChange={onSettingsChange} />

      {/* Save Bar */}
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} />
    </div>
  );
}

export default BoothCameraHub;
