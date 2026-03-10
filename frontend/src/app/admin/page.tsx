'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, BarChart3, Plus, Calendar, Zap, Share2, Printer,
  Search, Filter, TrendingUp, DollarSign, Users, Clock,
} from 'lucide-react';
import { getDashboardStats, getEvents } from '@/lib/api';
import { EventList } from '@/components/admin/EventList';
import { CreateEventModal } from '@/components/admin/CreateEventModal';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Tab = 'events' | 'analytics';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('events');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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
    { label: 'Total Photos', value: summary.totalPhotos || 0, icon: <Camera className="w-5 h-5" />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'GIFs Made',    value: summary.totalGIFs   || 0, icon: <Zap className="w-5 h-5" />,   color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'AI Generated', value: summary.totalAI     || 0, icon: <BarChart3 className="w-5 h-5" />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Total Shares', value: summary.totalShares || 0, icon: <Share2 className="w-5 h-5" />, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Prints',       value: summary.totalPrints || 0, icon: <Printer className="w-5 h-5" />, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    { label: 'Active Events',value: summary.totalEvents || 0, icon: <Calendar className="w-5 h-5" />, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ];

  // Revenue estimate (example: $19 per event + $0.5 per print)
  const revenueEst = ((summary.totalEvents || 0) * 19 + (summary.totalPrints || 0) * 0.5).toFixed(0);

  // Filter events
  const typedEvents = events as { name: string; status: string }[];
  const filteredEvents = typedEvents.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SnapBooth AI</h1>
              <p className="text-white/40 text-xs">Operator Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-white/40 hover:text-white text-sm transition-colors">
              Pricing
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Revenue highlight */}
        <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">~${revenueEst} estimated revenue</p>
              <p className="text-white/40 text-xs">Based on {summary.totalEvents || 0} events · {summary.totalPrints || 0} prints</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-white font-bold text-xl">{summary.totalPhotos || 0}</p>
              <p className="text-white/40 text-xs">photos taken</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">
                {summary.totalPhotos ? Math.round(((summary.totalShares || 0) / (summary.totalPhotos || 1)) * 100) : 0}%
              </p>
              <p className="text-white/40 text-xs">share rate</p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
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
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color} mb-2`}>
                  {card.icon}
                </div>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
                <div className="text-white/40 text-xs">{card.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {(['events', 'analytics'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {t === 'events' ? '📅 Events' : '📊 Analytics'}
              </button>
            ))}
          </div>

          {/* Search + filter bar — only on events tab */}
          {tab === 'events' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search events…"
                  className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 w-44"
                />
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                <Filter className="w-3.5 h-3.5 text-white/30 ml-1.5" />
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      statusFilter === s ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab content */}
        {tab === 'events' && (
          <EventList
            events={filteredEvents}
            onCreateNew={() => setShowCreate(true)}
            onRefresh={async () => {
              const ev = await getEvents();
              setEvents(ev);
              toast.success('Refreshed');
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
            toast.success('Event created!');
          }}
        />
      )}
    </div>
  );
}
