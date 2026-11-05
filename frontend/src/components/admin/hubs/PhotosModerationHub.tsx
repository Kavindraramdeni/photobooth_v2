'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  Download,
  Users,
  Image as ImageIcon,
  CheckSquare,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotosModerationHubProps {
  event: { id: string; name: string; slug: string };
  API_BASE: string;
}

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  mode: string;
  created_at: string;
  is_hidden: boolean;
}

interface Lead {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  consented: boolean;
  created_at: string;
}

type FilterType = 'all' | 'visible' | 'hidden';

// ─── Helper: auth token ───────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sb_access_token') ?? '';
}

// ─── Helper: auth headers ────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getToken()}` };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Dark glass-morphism card wrapper */
function Card({ title, icon, children, action }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-white/40">{icon}</span>}
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider text-white/60">
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Stat bubble */
function StatBubble({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-white/40">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-white font-black text-2xl">{value}</div>
    </div>
  );
}

/** Mode badge */
function ModeBadge({ mode }: { mode: string }) {
  const labels: Record<string, string> = {
    gif: '🎬 GIF',
    boomerang: '🔄 Boomerang',
    strip: '🎞️ Strip',
    ai: '🤖 AI',
    photo: '📸 Photo',
  };
  return (
    <span className="text-xs bg-white/10 text-white/60 px-1.5 py-0.5 rounded-md font-medium">
      {labels[mode] ?? mode}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PhotosModerationHub({ event, API_BASE }: PhotosModerationHubProps) {
  // ── state ──
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [batchWorking, setBatchWorking] = useState(false);

  // ─── Fetch photos ────────────────────────────────────────────────────────

  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`${API_BASE}/api/photos/event/${event.id}?include_hidden=true`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load photos');
      const data = await res.json();
      setPhotos(Array.isArray(data) ? data : data.photos ?? []);
    } catch (err) {
      toast.error('Could not load photos');
      console.error(err);
    } finally {
      setLoadingPhotos(false);
    }
  }, [API_BASE, event.id]);

  // ─── Fetch leads ─────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/event/${event.id}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load leads');
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : data.leads ?? []);
    } catch (err) {
      toast.error('Could not load leads');
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  }, [API_BASE, event.id]);

  useEffect(() => {
    fetchPhotos();
    fetchLeads();
  }, [fetchPhotos, fetchLeads]);

  // ─── Hide / Unhide single photo ──────────────────────────────────────────

  async function toggleHide(photo: Photo) {
    try {
      const res = await fetch(`${API_BASE}/api/photos/${photo.id}/moderate`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_hidden: !photo.is_hidden }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, is_hidden: !p.is_hidden } : p)),
      );
      toast.success(photo.is_hidden ? 'Photo restored' : 'Photo hidden');
    } catch (err) {
      toast.error('Action failed');
      console.error(err);
    }
  }

  // ─── Batch hide / unhide ─────────────────────────────────────────────────

  async function batchAction(action: 'hide' | 'unhide') {
    if (selectedPhotos.size === 0) return;
    setBatchWorking(true);
    try {
      await Promise.all(
        Array.from(selectedPhotos).map((id) =>
          fetch(`${API_BASE}/api/photos/${id}/moderate`, {
            method: 'PATCH',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_hidden: action === 'hide' }),
          }),
        ),
      );
      setPhotos((prev) =>
        prev.map((p) =>
          selectedPhotos.has(p.id) ? { ...p, is_hidden: action === 'hide' } : p,
        ),
      );
      toast.success(
        `${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's' : ''} ${action === 'hide' ? 'hidden' : 'restored'}`,
      );
      setSelectedPhotos(new Set());
    } catch (err) {
      toast.error('Batch action failed');
      console.error(err);
    } finally {
      setBatchWorking(false);
    }
  }

  // ─── Batch download (placeholder — triggers server ZIP) ──────────────────

  function handleBatchDownload() {
    window.open(
      `${API_BASE}/api/photos/event/${event.id}/zip`,
      '_blank',
    );
  }

  // ─── Download all ZIP ────────────────────────────────────────────────────

  function handleDownloadAll() {
    window.open(`${API_BASE}/api/photos/event/${event.id}/zip`, '_blank');
  }

  // ─── Export leads CSV ────────────────────────────────────────────────────

  function handleExportLeads() {
    try {
      if (leads.length === 0) {
        toast.error('No leads to export');
        return;
      }
      const headers = ['Name', 'Email', 'Phone', 'Consented', 'Captured At'];
      const rows = leads.map(l => [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        l.consented ? 'Yes' : 'No',
        `"${new Date(l.created_at).toLocaleString()}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${event.slug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Leads exported');
    } catch (err) {
      toast.error('Could not export leads');
      console.error(err);
    }
  }

  // ─── Selection helpers ───────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedPhotos(new Set(filteredPhotos.map((p) => p.id)));
  }

  function clearSelection() {
    setSelectedPhotos(new Set());
  }

  // ─── Derived values ──────────────────────────────────────────────────────

  const totalHidden = photos.filter((p) => p.is_hidden).length;

  const filteredPhotos = photos.filter((p) => {
    if (filter === 'visible') return !p.is_hidden;
    if (filter === 'hidden') return p.is_hidden;
    return true;
  });

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Quick Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBubble
          label="Total Photos"
          value={photos.length}
          icon={<ImageIcon size={14} />}
        />
        <StatBubble
          label="Hidden"
          value={totalHidden}
          icon={<EyeOff size={14} />}
        />
        <StatBubble
          label="Leads"
          value={leads.length}
          icon={<Users size={14} />}
        />
        <StatBubble
          label="Sessions"
          value="—"
          icon={<CheckSquare size={14} />}
        />
      </div>

      {/* ── Photo Moderation Card ── */}
      <Card
        title="Photo Moderation"
        icon={<ImageIcon size={16} />}
        action={
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} />
            Download All ZIP
          </button>
        }
      >
        {/* Filter tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 self-start">
          {(['all', 'visible', 'hidden'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); clearSelection(); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-500 text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {f}
              {f === 'all' && ` (${photos.length})`}
              {f === 'visible' && ` (${photos.length - totalHidden})`}
              {f === 'hidden' && ` (${totalHidden})`}
            </button>
          ))}
        </div>

        {/* Batch actions bar */}
        {selectedPhotos.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-4 py-3">
            <span className="text-indigo-300 text-sm font-medium mr-auto">
              {selectedPhotos.size} selected
            </span>
            <button
              onClick={() => batchAction('hide')}
              disabled={batchWorking}
              className="flex items-center gap-1.5 text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <EyeOff size={12} />
              Hide Selected
            </button>
            <button
              onClick={() => batchAction('unhide')}
              disabled={batchWorking}
              className="flex items-center gap-1.5 text-xs font-medium bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Eye size={12} />
              Unhide Selected
            </button>
            <button
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 text-white/60 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={12} />
              Download ZIP
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* Select all helper */}
        {filteredPhotos.length > 0 && selectedPhotos.size === 0 && (
          <button
            onClick={selectAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 self-start transition-colors"
          >
            Select all {filteredPhotos.length}
          </button>
        )}

        {/* Photo grid */}
        {loadingPhotos ? (
          <div className="text-center py-16 text-white/30 text-sm">Loading photos…</div>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon size={32} className="text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No photos found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPhotos.map((photo) => {
              const isSelected = selectedPhotos.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-xl overflow-hidden bg-white/5 border transition-all ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'border-white/10 hover:border-white/20'
                  } ${photo.is_hidden ? 'opacity-50' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumb_url ?? photo.url}
                      alt={`Photo ${photo.id}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <button
                      onClick={() => toggleHide(photo)}
                      className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors backdrop-blur-sm"
                    >
                      {photo.is_hidden ? (
                        <>
                          <Eye size={12} />
                          Unhide
                        </>
                      ) : (
                        <>
                          <EyeOff size={12} />
                          Hide
                        </>
                      )}
                    </button>
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(photo.id)}
                    className={`absolute top-2 left-2 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-indigo-500 border-indigo-500'
                        : 'bg-black/40 border-white/30 opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label="Select photo"
                  >
                    {isSelected && (
                      <svg
                        viewBox="0 0 12 12"
                        className="w-3 h-3 text-white fill-current"
                      >
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                    )}
                  </button>

                  {/* Mode badge + hidden indicator */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
                    <ModeBadge mode={photo.mode} />
                    {photo.is_hidden && (
                      <span className="text-xs bg-red-500/30 border border-red-500/40 text-red-300 px-1.5 py-0.5 rounded-md">
                        hidden
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Lead Capture Card ── */}
      <Card
        title="Lead Capture"
        icon={<Users size={16} />}
        action={
          <button
            onClick={handleExportLeads}
            className="flex items-center gap-1.5 bg-green-500/15 hover:bg-green-500/25 border border-green-500/25 text-green-300 hover:text-green-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        }
      >
        {loadingLeads ? (
          <div className="text-center py-8 text-white/30 text-sm">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-10">
            <Users size={32} className="text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No leads captured yet</p>
            <p className="text-white/20 text-xs mt-1">
              Leads will appear here once guests fill in the lead form
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/8">
                    <th className="text-left pb-3 pr-4">Name</th>
                    <th className="text-left pb-3 pr-4">Email</th>
                    <th className="text-left pb-3 pr-4">Phone</th>
                    <th className="text-left pb-3 pr-4">Consent</th>
                    <th className="text-left pb-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-white/3 transition-colors">
                      <td className="py-3 pr-4 text-white/80">{lead.name ?? '—'}</td>
                      <td className="py-3 pr-4 text-white/60">{lead.email}</td>
                      <td className="py-3 pr-4 text-white/60">{lead.phone ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            lead.consented
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-white/8 text-white/40 border-white/15'
                          }`}
                        >
                          {lead.consented ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3 text-white/40 text-xs">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="flex flex-col gap-2 md:hidden">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 font-medium text-sm">
                      {lead.name ?? lead.email}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        lead.consented
                          ? 'bg-green-500/20 text-green-300 border-green-500/30'
                          : 'bg-white/8 text-white/40 border-white/15'
                      }`}
                    >
                      {lead.consented ? 'Consented' : 'No consent'}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs">{lead.email}</p>
                  {lead.phone && <p className="text-white/40 text-xs">{lead.phone}</p>}
                  <p className="text-white/25 text-xs">
                    {new Date(lead.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default PhotosModerationHub;
