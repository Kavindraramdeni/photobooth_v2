'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Lock, CreditCard, Camera, ArrowLeft,
  Loader2, Crown, Zap, CheckCircle, AlertTriangle, ExternalLink
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'text-zinc-400'   },
  starter:  { label: 'Starter',  color: 'text-blue-400'   },
  pro:      { label: 'Pro',      color: 'text-violet-400' },
  business: { label: 'Business', color: 'text-amber-400'  },
};

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-violet-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-white/50 mb-1.5">
        <span>{label}</span>
        <span>{limit === -1 ? `${used} / Unlimited` : `${used} / ${limit}`}</span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: limit === -1 ? '8%' : `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, token, logout } = useAuth();
  const router = useRouter();

  const [planData, setPlanData] = useState<Record<string, unknown> | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword]   = useState(false);

  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    api.get('/billing/my-plan')
      .then(r => setPlanData(r.data))
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && typeof window !== 'undefined') router.push('/login?from=/account');
  }, [user, router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await fetch(`${API_BASE}/api/auth/update-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await api.post('/billing/portal');
      window.location.href = res.data.portalUrl;
    } catch {
      toast.error('Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const plan     = (planData?.plan as string) || 'free';
  const usage    = (planData?.usage as Record<string, number>) || {};
  const planInfo = PLAN_LABELS[plan] || PLAN_LABELS.free;
  const sub      = planData?.subscription as Record<string, unknown> | null;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">SnapBooth AI</span>
          </div>
          <Link href="/admin" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account settings</h1>
          <p className="text-white/40 text-sm mt-1">Manage your profile, password, and subscription.</p>
        </div>

        {/* ── Plan & Usage ── */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-violet-400" />
              <h2 className="font-semibold">Current plan</h2>
            </div>
            <span className={`text-sm font-bold ${planInfo.color}`}>{planInfo.label}</span>
          </div>

          {planLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-5 rounded bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              <UsageBar used={usage.eventsThisMonth || 0} limit={usage.eventLimit || 2} label="Events this month" />
              <UsageBar used={usage.photosThisMonth || 0} limit={usage.photoLimit || 100} label="Photos this month" />
            </div>
          )}

          {sub && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${
              sub.status === 'trialing'
                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                : sub.status === 'active'
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {sub.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {sub.status === 'trialing' && sub.trialEndsAt
                ? `Free trial — ends ${new Date(sub.trialEndsAt as string).toLocaleDateString()}`
                : sub.status === 'active' ? 'Subscription active'
                : `Subscription ${sub.status}`}
            </div>
          )}

          <div className="flex gap-3">
            {plan === 'free' || plan === 'starter' ? (
              <Link href="/pricing"
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                <Zap className="w-3.5 h-3.5" /> Upgrade plan
              </Link>
            ) : null}
            {plan !== 'free' && (
              <button onClick={openBillingPortal} disabled={portalLoading}
                className="flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 text-sm px-4 py-2 rounded-lg transition disabled:opacity-50">
                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Manage billing
              </button>
            )}
          </div>
        </div>

        {/* ── Profile ── */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold">Profile</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 font-medium block mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 font-medium block mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input value={user.email} disabled
                  className="w-full bg-white/3 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white/30 cursor-not-allowed" />
              </div>
              <p className="text-xs text-white/25 mt-1">Email cannot be changed here. Contact support.</p>
            </div>
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50">
              {savingProfile ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : 'Save profile'}
            </button>
          </form>
        </div>

        {/* ── Password ── */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold">Change password</h2>
          </div>
          <form onSubmit={savePassword} className="space-y-4">
            {[
              { label: 'Current password', value: currentPassword, set: setCurrentPassword, auto: 'current-password' },
              { label: 'New password',     value: newPassword,     set: setNewPassword,     auto: 'new-password' },
              { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, auto: 'new-password' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-white/40 font-medium block mb-1.5">{f.label}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
                    autoComplete={f.auto} required placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition" />
                </div>
              </div>
            ))}
            <button type="submit" disabled={savingPassword}
              className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50">
              {savingPassword ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</> : 'Update password'}
            </button>
          </form>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
          <h2 className="font-semibold text-red-400 mb-1">Sign out</h2>
          <p className="text-white/35 text-sm mb-4">You will be redirected to the login page.</p>
          <button onClick={async () => { await logout(); router.push('/login'); }}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg transition">
            Sign out of all devices
          </button>
        </div>
      </div>
    </div>
  );
}
