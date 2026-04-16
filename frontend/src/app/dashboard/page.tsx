'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Calendar, Zap, Star, CreditCard,
  ExternalLink, Copy, Plus, CheckCircle,
  AlertTriangle, ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { CreateEventModal } from '@/components/admin/CreateEventModal';
import { EventList } from '@/components/admin/EventList';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import toast from 'react-hot-toast';

const PLAN_COLORS: Record<string, string> = {
  starter: '#3b82f6',
  pro: '#7c3aed',
  business: '#f59e0b',
  per_event: '#10b981',
  none: '#6b7280',
};

export default function DashboardPage() {
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [subStatus, setSubStatus] = useState<Record<string, any> | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'events' | 'analytics' | 'billing'>('events');
  const [loading, setLoading] = useState(false);

  // Check URL params for success messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      toast.success(`🎉 Welcome! Your ${params.get('plan')} plan is active.`);
    }
    if (params.get('event_paid') === 'true') {
      toast.success('✅ Event access purchased!');
    }
    // Clean URL
    window.history.replaceState({}, '', '/dashboard');
  }, []);

  async function handleLogin() {
    if (!emailInput.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/billing/status/${encodeURIComponent(emailInput)}`);
      setSubStatus(res.data);
      setEmail(emailInput);

      // Load events and stats
      const [eventsRes, statsRes] = await Promise.all([
        api.get('/events'),
        api.get('/analytics/dashboard'),
      ]);
      setEvents(eventsRes.data.events || []);
      setStats(statsRes.data);
    } catch (e) {
      toast.error('Could not find your account. Check your email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    try {
      const res = await api.post('/billing/portal', { operatorEmail: email });
      window.open(res.data.portalUrl, '_blank');
    } catch {
      toast.error('Could not open billing portal.');
    }
  }

  // ─── Login gate ─────────────────────────────────────────────────────────────
  if (!email) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Operator Dashboard</h1>
            <p className="text-white/50 text-sm">Enter your email to access your account</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="your@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Access Dashboard <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>

          <p className="text-center mt-4">
            <a href="/pricing" className="text-purple-400 text-sm hover:underline">Don't have an account? Start free →</a>
          </p>
        </motion.div>
      </div>
    );
  }

  const planColor = PLAN_COLORS[subStatus?.plan] || '#6b7280';
  const isActive = subStatus?.isActive;

  return (
    <div className="min-h-screen bg-[#060610] text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold">SnapBooth AI</div>
              <div className="text-white/40 text-xs">{email}</div>
            </div>
          </div>

          {/* Subscription badge */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border"
              style={{ borderColor: `${planColor}40`, background: `${planColor}15`, color: planColor }}
            >
              {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {subStatus?.plan ? subStatus.plan.charAt(0).toUpperCase() + subStatus.plan.slice(1) : 'No Plan'}
              {subStatus?.isTrialing && ` · ${subStatus.trialDaysLeft}d trial left`}
            </div>

            {isActive ? (
              <button onClick={handleManageBilling} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" /> Manage billing
              </button>
            ) : (
              <a href="/pricing" className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                <Star className="w-4 h-4" /> Upgrade plan
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Trial warning */}
        {subStatus?.isTrialing && subStatus.trialDaysLeft <= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <div className="font-semibold text-amber-300">Trial ending soon</div>
                <div className="text-amber-300/70 text-sm">{subStatus.trialDaysLeft} days left — add a payment method to keep access</div>
              </div>
            </div>
            <button onClick={handleManageBilling} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl text-sm transition-all">
              Add payment method
            </button>
          </motion.div>
        )}

        {/* Quick stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Photos taken', value: stats.summary?.totalPhotos || 0, icon: '📸' },
              { label: 'GIFs created', value: stats.summary?.totalGIFs || 0, icon: '🎬' },
              { label: 'AI generated', value: stats.summary?.totalAI || 0, icon: '✨' },
              { label: 'Total shares', value: stats.summary?.totalShares || 0, icon: '🔗' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4"
              >
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
                <div className="text-white/40 text-sm">{s.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {(['events', 'analytics', 'billing'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'}`}
              >
                {t === 'events' ? '📅 Events' : t === 'analytics' ? '📊 Analytics' : '💳 Billing'}
              </button>
            ))}
          </div>

          {tab === 'events' && (
            <button
              onClick={() => setShowCreate(true)}
              disabled={!isActive}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" /> New Event
            </button>
          )}
        </div>

        {tab === 'events' && (
          <EventList
            events={events}
            onCreateNew={() => setShowCreate(true)}
            onRefresh={async () => { const r = await api.get('/events'); setEvents(r.data.events); }}
          />
        )}
        {tab === 'analytics' && <AnalyticsPanel stats={stats} />}
        {tab === 'billing' && (
          <div className="max-w-lg">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Your subscription</h3>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Current plan</span>
                <span className="font-semibold" style={{ color: planColor }}>{subStatus?.plan || 'None'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Status</span>
                <span className={`font-medium ${isActive ? 'text-green-400' : 'text-red-400'}`}>{subStatus?.status || 'inactive'}</span>
              </div>
              {subStatus?.isTrialing && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Trial ends in</span>
                  <span className="text-amber-400 font-medium">{subStatus.trialDaysLeft} days</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <button onClick={handleManageBilling} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm">
                  <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-white/50" /> Manage payment method</span>
                  <ExternalLink className="w-4 h-4 text-white/40" />
                </button>
                <button onClick={handleManageBilling} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-white/50" /> View invoices</span>
                  <ExternalLink className="w-4 h-4 text-white/40" />
                </button>
                {!isActive && (
                  <a href="/pricing" className="block w-full text-center py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-sm transition-all">
                    Upgrade plan →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); const r = await api.get('/events'); setEvents(r.data.events); }}
        />
      )}
    </div>
  );
}
