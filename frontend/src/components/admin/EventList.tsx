'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink, Settings, Copy, Calendar, MapPin, Camera,
  MoreHorizontal, CopyPlus, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, createEvent } from '@/lib/api';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string;
  status: string;
  photoCount?: number;
  branding?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

interface Props {
  events: unknown[];
  onCreateNew: () => void;
  onRefresh: () => void;
}

export function EventList({ events, onCreateNew, onRefresh }: Props) {
  const typedEvents = events as Event[];
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function copyBoothUrl(slug: string) {
    const url = `${window.location.origin}/booth?event=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Booth URL copied!');
  }

  async function handleDuplicate(event: Event) {
    setDuplicating(event.id);
    setMenuOpen(null);
    try {
      await createEvent({
        name: `${event.name} (Copy)`,
        date: event.date,
        venue: event.venue || '',
        branding: event.branding || {},
        settings: event.settings || {},
      });
      toast.success('Event duplicated!');
      onRefresh();
    } catch {
      toast.error('Could not duplicate event');
    } finally {
      setDuplicating(null);
    }
  }

  async function handleToggleStatus(event: Event) {
    setToggling(event.id);
    setMenuOpen(null);
    try {
      const newStatus = event.status === 'active' ? 'inactive' : 'active';
      await api.put(`/events/${event.id}`, { status: newStatus });
      toast.success(`Event ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not update status');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(event: Event) {
    if (!confirm(`Permanently delete "${event.name}"? All photos and data will be lost.`)) return;
    setDeleting(event.id);
    setMenuOpen(null);
    try {
      await api.delete(`/events/${event.id}`);
      toast.success('Event deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not delete event');
    } finally {
      setDeleting(null);
    }
  }

  if (typedEvents.length === 0) {
    return (
      <div className="text-center py-20 backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <Camera className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h3 className="text-white/70 text-lg font-medium mb-2">No events found</h3>
        <p className="text-white/40 text-sm mb-6">Create your first event to get started</p>
        <button
          onClick={onCreateNew}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-6 py-3 rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
        >
          Create First Event
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {typedEvents.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="relative group backdrop-blur-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] rounded-3xl p-5 sm:p-6 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.15)]"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-bold text-lg text-white truncate group-hover:text-violet-300 transition-colors">{event.name}</h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 border backdrop-blur-md ${
                    event.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  {event.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-white/50 text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-violet-400" />
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    {event.venue}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-pink-400" />
                  {event.photoCount || 0} photos
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyBoothUrl(event.slug)}
                title="Copy booth URL"
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/60 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </button>
              <Link
                href={`/booth?event=${event.slug}`}
                target="_blank"
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/60 hover:text-white"
                title="Open booth"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href={`/admin/events/${event.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-violet-500/20"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Link>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === event.id ? null : event.id)}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/60 hover:text-white"
                  disabled={duplicating === event.id || toggling === event.id || deleting === event.id}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen === event.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full mt-2 z-20 backdrop-blur-2xl bg-zinc-900/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden w-48 p-1">
                      <button
                        onClick={() => handleDuplicate(event)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/10 rounded-xl transition-all font-medium"
                      >
                        <CopyPlus className="w-4 h-4 text-violet-400" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleToggleStatus(event)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/10 rounded-xl transition-all font-medium"
                      >
                        {event.status === 'active'
                          ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                          : <ToggleLeft className="w-4 h-4 text-white/40" />
                        }
                        {event.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        onClick={() => handleDelete(event)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete event
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
