'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Settings, Copy, Calendar, MapPin, Camera } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string;
  status: string;
  photoCount?: number;
}

interface Props {
  events: unknown[];
  onCreateNew: () => void;
  onRefresh: () => void;
}

export function EventList({ events, onCreateNew, onRefresh }: Props) {
  const typedEvents = events as Event[];

  function copyBoothUrl(slug: string) {
    const url = `${window.location.origin}/booth?event=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Booth URL copied!');
  }

  if (typedEvents.length === 0) {
    return (
      <div className="text-center py-20">
        <Camera className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h3 className="text-white/60 text-lg font-medium mb-2">No events yet</h3>
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
          transition={{ delay: i * 0.05 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg truncate">{event.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                }`}>
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
              {/* Copy booth URL */}
              <button
                onClick={() => copyBoothUrl(event.slug)}
                title="Copy booth URL"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Open booth in new tab */}
              <Link
                href={`/booth?event=${event.slug}`}
                target="_blank"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
                title="Open booth"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>

              {/* Manage event — goes to /admin/events/[id] */}
              <Link
                href={`/admin/events/${event.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 transition-colors text-purple-300 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
