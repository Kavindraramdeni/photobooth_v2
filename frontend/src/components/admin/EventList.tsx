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
    } catch {
      toast.error('Could not update status');
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
    } catch {
      toast.error('Could not delete event');
    } finally {
      setDeleting(null);
    }
  }

  if (typedEvents.length === 0) {
    return (
      <div className="text-center py-20">
        <Camera className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h3 className="text-white/60 text-lg font-medium mb-2">No events found</h3>
        <p className="text-white/30 text-sm mb-6">Create your first event to get started</p>
        <button
          onClick={onCreateNew}
          className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          Create First Event
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {typedEvents.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg truncate">{event.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    event.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {event.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-white/40 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.venue}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  {event.photoCount || 0} photos
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyBoothUrl(event.slug)}
                title="Copy booth URL"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </button>
              <Link
                href={`/booth?event=${event.slug}`}
                target="_blank"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
                title="Open booth"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href={`/admin/events/${event.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 transition-colors text-purple-300 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Link>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === event.id ? null : event.id)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60"
                  disabled={duplicating === event.id || toggling === event.id || deleting === event.id}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen === event.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-2xl overflow-hidden w-44">
                      <button
                        onClick={() => handleDuplicate(event)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <CopyPlus className="w-4 h-4" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleToggleStatus(event)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        {event.status === 'active'
                          ? <ToggleRight className="w-4 h-4 text-green-400" />
                          : <ToggleLeft className="w-4 h-4 text-white/40" />
                        }
                        {event.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <div className="border-t border-white/10" />
                      <button
                        onClick={() => handleDelete(event)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
