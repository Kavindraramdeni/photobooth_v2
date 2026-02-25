'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, BarChart3, Settings, Plus, Calendar, Users, Zap, Share2, Printer } from 'lucide-react';
import { getDashboardStats, getEvents } from '@/lib/api';
import { EventList } from '@/components/admin/EventList';
import { CreateEventModal } from '@/components/admin/CreateEventModal';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import Link from 'next/link';

type Tab = 'events' | 'analytics';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('events');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, eventsData] = await Promise.all([
          getDashboardStats(),
          getEvents(),
        ]);
        setStats(statsData);
        setEvents(eventsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = (stats as { summary?: Record<string, number> })?.summary || {};

  const statCards = [
    { label: 'Total Photos', value: summary.totalPhotos || 0, icon: <Camera className="w-5 h-5" />, color: 'text-blue-400' },
    { label: 'GIFs Made', value: summary.totalGIFs || 0, icon: <Zap className="w-5 h-5" />, color: 'text-yellow-400' },
    { label: 'AI Generations', value: summary.totalAI || 0, icon: <Zap className="w-5 h-5" />, color: 'text-purple-400' },
    { label: 'Total Shares', value: summary.totalShares || 0, icon: <Share2 className="w-5 h-5" />, color: 'text-green-400' },
    { label: 'Prints', value: summary.totalPrints || 0, icon: <Printer className="w-5 h-5" />, color: 'text-pink-400' },
    { label: 'Events', value: summary.totalEvents || 0, icon: <Calendar className="w-5 h-5" />, color: 'text-orange-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SnapBooth AI</h1>
              <p className="text-white/40 text-xs">Operator Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Event
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl shimmer-bg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4"
              >
                <div className={`${card.color} mb-2`}>{card.icon}</div>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
                <div className="text-white/40 text-xs">{card.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          {(['events', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'events' ? '📅 Events' : '📊 Analytics'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'events' && (
          <EventList
            events={events}
            onCreateNew={() => setShowCreate(true)}
            onRefresh={async () => {
              const ev = await getEvents();
              setEvents(ev);
            }}
          />
        )}

        {tab === 'analytics' && <AnalyticsPanel stats={stats} />}
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            const ev = await getEvents();
            setEvents(ev);
          }}
        />
      )}
    </div>
  );
}
