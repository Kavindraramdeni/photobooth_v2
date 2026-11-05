'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getEvent, updateEvent, getEventStats,
} from '@/lib/api';
import toast from 'react-hot-toast';

import HubNavigationBar, { HubId } from '@/components/admin/navigation/HubNavigationBar';
import LiveOperationsHub from '@/components/admin/hubs/LiveOperationsHub';
import BoothCameraHub from '@/components/admin/hubs/BoothCameraHub';
import DesignTemplatesHub from '@/components/admin/hubs/DesignTemplatesHub';
import PrintDeliveryHub from '@/components/admin/hubs/PrintDeliveryHub';
import PhotosModerationHub from '@/components/admin/hubs/PhotosModerationHub';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EventData {
  id: string; name: string; slug: string; date: string; venue: string; status: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface Stats {
  totalPhotos: number; totalGIFs: number; totalBoomerangs: number; totalStrips: number;
  totalAIGenerated: number; totalShares: number; totalPrints: number; totalSessions: number;
}

const VALID_HUBS: HubId[] = ['live', 'booth', 'design', 'delivery', 'photos'];

export default function EventManagePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyHubs, setDirtyHubs] = useState<Set<HubId>>(new Set());

  // Derive active hub from URL ?hub= param
  const rawHub = searchParams.get('hub') as HubId | null;
  const activeHub: HubId = rawHub && VALID_HUBS.includes(rawHub) ? rawHub : 'live';

  function setActiveHub(hub: HubId) {
    const url = new URL(window.location.href);
    url.searchParams.set('hub', hub);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  // Load event + stats
  useEffect(() => {
    async function load() {
      try {
        const [ev, st] = await Promise.all([
          getEvent(eventId),
          getEventStats(eventId),
        ]);
        setEvent(ev);
        setStats(st);
      } catch {
        toast.error('Event not found');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId, router]);

  // Save handler
  const handleSave = useCallback(async () => {
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
      setDirtyHubs(new Set());
      toast.success('Changes saved!');
    } catch {
      toast.error('Save failed — please try again');
    } finally {
      setSaving(false);
    }
  }, [event]);

  // Settings updaters
  function updateSettings(key: string, value: unknown) {
    if (!event) return;
    setEvent(prev => prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev);
    setDirtyHubs(prev => new Set(prev).add(activeHub));
  }

  function updateBranding(key: string, value: unknown) {
    if (!event) return;
    setEvent(prev => prev ? { ...prev, branding: { ...prev.branding, [key]: value } } : prev);
    setDirtyHubs(prev => new Set(prev).add(activeHub));
  }

  const isDirty = dirtyHubs.size > 0;

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm">Loading event…</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Global gradient background ───────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-8">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-lg sm:text-xl truncate">{event.name}</h1>
              <p className="text-zinc-500 text-xs sm:text-sm truncate">
                {event.venue && `${event.venue} · `}
                {event.date ? new Date(event.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date set'}
              </p>
            </div>
          </div>

          {/* Save button — desktop */}
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-violet-500/25 flex-shrink-0"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* ── Hub Navigation ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <HubNavigationBar
            activeHub={activeHub}
            onHubChange={setActiveHub}
            dirtyHubs={dirtyHubs}
          />
        </div>

        {/* ── Unsaved changes banner (mobile) ──────────────────────────────── */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="sm:hidden fixed top-4 inset-x-4 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-zinc-900/95 backdrop-blur-xl border border-amber-500/30 rounded-xl shadow-xl"
            >
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Unsaved changes
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {saving ? '…' : 'Save'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hub Content ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeHub}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {activeHub === 'live' && (
              <LiveOperationsHub
                event={event}
                stats={stats}
                API_BASE={API_BASE}
              />
            )}

            {activeHub === 'booth' && (
              <BoothCameraHub
                settings={event.settings}
                onSettingsChange={updateSettings}
                onSave={handleSave}
                saving={saving}
                dirty={dirtyHubs.has('booth')}
                eventId={event.id}
              />
            )}

            {activeHub === 'design' && (
              <DesignTemplatesHub
                event={event}
                branding={event.branding}
                settings={event.settings}
                onBrandingChange={updateBranding}
                onSettingsChange={updateSettings}
                onSave={handleSave}
                saving={saving}
                dirty={dirtyHubs.has('design')}
                API_BASE={API_BASE}
              />
            )}

            {activeHub === 'delivery' && (
              <PrintDeliveryHub
                event={event}
                settings={event.settings}
                onSettingsChange={updateSettings}
                onSave={handleSave}
                saving={saving}
                dirty={dirtyHubs.has('delivery')}
                API_BASE={API_BASE}
              />
            )}

            {activeHub === 'photos' && (
              <PhotosModerationHub
                event={event}
                API_BASE={API_BASE}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Desktop save footer (always visible when dirty) ──────────────── */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="hidden sm:flex fixed bottom-6 right-6 z-40 items-center gap-3 px-5 py-3 bg-zinc-900/95 backdrop-blur-xl border border-amber-500/20 rounded-2xl shadow-2xl"
            >
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-300 text-sm">Unsaved changes</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
