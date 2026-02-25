'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getEvent, updateEvent, getEventPhotos, getEventStats } from '@/lib/api';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string;
  status: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface Stats {
  totalPhotos: number;
  totalGIFs: number;
  totalAIGenerated: number;
  totalShares: number;
  totalPrints: number;
  totalSessions: number;
}

export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'overview' | 'branding' | 'settings' | 'photos'>('overview');

  useEffect(() => {
    async function load() {
      try {
        const [ev, st, ph] = await Promise.all([
          getEvent(eventId),
          getEventStats(eventId),
          getEventPhotos(eventId),
        ]);
        setEvent(ev);
        setStats(st);
        setPhotos(ph.photos || []);
      } catch (e) {
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
        name: event.name,
        venue: event.venue,
        date: event.date,
        branding: event.branding,
        settings: event.settings,
      });
      toast.success('Event saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateBranding(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, branding: { ...event.branding, [key]: value } });
  }

  function updateSettings(key: string, value: unknown) {
    if (!event) return;
    setEvent({ ...event, settings: { ...event.settings, [key]: value } });
  }

  const boothUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/booth?event=${event?.slug}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Dashboard
            </Link>
            <span className="text-white/20">/</span>
            <h1 className="font-bold text-lg">{event.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
            }`}>
              {event.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Copy booth URL */}
            <button
              onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Booth URL copied!'); }}
              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy Booth URL
            </button>
            {/* Open booth */}
            <Link
              href={`/booth?event=${event.slug}`}
              target="_blank"
              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open Booth
            </Link>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 font-semibold"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            {[
              { label: 'Photos', value: stats.totalPhotos, emoji: '📸' },
              { label: 'GIFs', value: stats.totalGIFs, emoji: '🎬' },
              { label: 'AI Used', value: stats.totalAIGenerated, emoji: '🤖' },
              { label: 'Shares', value: stats.totalShares, emoji: '📤' },
              { label: 'Prints', value: stats.totalPrints, emoji: '🖨️' },
              { label: 'Sessions', value: stats.totalSessions, emoji: '👥' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{s.emoji}</div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-white/40 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          {(['overview', 'branding', 'settings', 'photos'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'overview' ? '📋 Overview' : t === 'branding' ? '🎨 Branding' : t === 'settings' ? '⚙️ Settings' : '📸 Photos'}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Event Details</h3>
              <div>
                <label className="text-white/50 text-sm block mb-1">Event Name</label>
                <input
                  value={event.name}
                  onChange={(e) => setEvent({ ...event, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Venue</label>
                <input
                  value={event.venue || ''}
                  onChange={(e) => setEvent({ ...event, venue: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Date</label>
                <input
                  type="date"
                  value={event.date?.split('T')[0] || ''}
                  onChange={(e) => setEvent({ ...event, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">Booth URL</h3>
              <div className="bg-black/40 rounded-xl p-4 mb-4">
                <code className="text-purple-300 text-sm break-all">{boothUrl}</code>
              </div>
              <p className="text-white/40 text-sm mb-4">Share this URL with your event operator. Open on iPad in Safari, then Add to Home Screen for full-screen mode.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { navigator.clipboard.writeText(boothUrl); toast.success('Copied!'); }}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors"
                >
                  Copy URL
                </button>
                <Link
                  href={`/booth?event=${event.slug}`}
                  target="_blank"
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors text-center"
                >
                  Open Booth
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Branding tab */}
        {tab === 'branding' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Branding Settings</h3>
              <div>
                <label className="text-white/50 text-sm block mb-1">Brand Color</label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={(event.branding?.primaryColor as string) || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer"
                  />
                  <input
                    value={(event.branding?.primaryColor as string) || '#7c3aed'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Footer Text (on photos)</label>
                <input
                  value={(event.branding?.footerText as string) || ''}
                  onChange={(e) => updateBranding('footerText', e.target.value)}
                  placeholder="e.g. Sarah & John's Wedding · June 2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1">Overlay Text (top of photo)</label>
                <input
                  value={(event.branding?.overlayText as string) || ''}
                  onChange={(e) => updateBranding('overlayText', e.target.value)}
                  placeholder="e.g. #SarahAndJohn2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder-white/20"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showDate"
                  checked={(event.branding?.showDate as boolean) ?? true}
                  onChange={(e) => updateBranding('showDate', e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                <label htmlFor="showDate" className="text-white/70 text-sm">Show date on photos</label>
              </div>
            </div>

            {/* Live preview */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">Preview</h3>
              <div
                className="rounded-xl overflow-hidden relative"
                style={{ background: (event.branding?.primaryColor as string) || '#7c3aed', aspectRatio: '4/3' }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
                  Photo Preview Area
                </div>
                {(event.branding?.overlayText as string) && (
                  <div className="absolute top-0 left-0 right-0 bg-black/40 px-4 py-2">
                    <span className="text-white text-sm font-bold">{event.branding.overlayText as string}</span>
                  </div>
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 py-3 px-4 text-center"
                  style={{ background: `${(event.branding?.primaryColor as string) || '#7c3aed'}dd` }}
                >
                  <span className="text-white text-sm font-bold">
                    {(event.branding?.footerText as string) || event.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-6">Booth Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-white/60 text-sm font-medium uppercase tracking-wider">Features</h4>
                {[
                  { key: 'allowAI', label: '🤖 AI Generation' },
                  { key: 'allowGIF', label: '🎬 GIF Mode' },
                  { key: 'allowBoomerang', label: '🔄 Boomerang' },
                  { key: 'allowPrint', label: '🖨️ Print' },
                  { key: 'allowRetakes', label: '🔁 Retakes' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 cursor-pointer">
                    <span className="text-white/80">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(event.settings?.[item.key] as boolean) ?? true}
                      onChange={(e) => updateSettings(item.key, e.target.checked)}
                      className="w-5 h-5 accent-purple-500"
                    />
                  </label>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-white/60 text-sm font-medium uppercase tracking-wider">Timing & Security</h4>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Countdown (seconds)</label>
                  <select
                    value={(event.settings?.countdownSeconds as number) || 3}
                    onChange={(e) => updateSettings('countdownSeconds', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  >
                    {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Session Timeout (seconds)</label>
                  <select
                    value={(event.settings?.sessionTimeout as number) || 60}
                    onChange={(e) => updateSettings('sessionTimeout', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  >
                    {[30, 60, 90, 120].map((n) => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-sm block mb-1">Operator PIN</label>
                  <input
                    type="password"
                    value={(event.settings?.operatorPin as string) || '1234'}
                    onChange={(e) => updateSettings('operatorPin', e.target.value)}
                    maxLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photos tab */}
        {tab === 'photos' && (
          <div>
            {photos.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <div className="text-5xl mb-4">📸</div>
                <p>No photos yet. Open the booth to start capturing!</p>
                <Link
                  href={`/booth?event=${event.slug}`}
                  target="_blank"
                  className="inline-block mt-4 bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-sm font-semibold transition-colors text-white"
                >
                  Open Booth Now
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {(photos as { id: string; thumb_url?: string; url: string; mode: string; created_at: string }[]).map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumb_url || photo.url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/20 hover:bg-white/40 rounded-lg p-2 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-xs text-white/70">
                      {photo.mode}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
