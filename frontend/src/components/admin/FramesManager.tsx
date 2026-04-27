'use client';

import { useState } from 'react';
import { Plus, X, Eye, EyeOff, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Frame {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  isActive: boolean;
}

export function FramesManager({ eventId, frames, onFramesUpdate }: {
  eventId: string;
  frames: Frame[];
  onFramesUpdate: (frames: Frame[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newFrame, setNewFrame] = useState({ name: '', file: null as File | null });
  const [uploading, setUploading] = useState(false);

  async function handleAddFrame() {
    if (!newFrame.name || !newFrame.file) {
      toast.error('Name and image required');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('sb_access_token');
      const fd = new FormData();
      fd.append('file', newFrame.file);
      fd.append('name', newFrame.name);

      const res = await fetch(`${API_BASE}/api/events/${eventId}/frames`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onFramesUpdate([...frames, data.frame]);
      setNewFrame({ name: '', file: null });
      setAdding(false);
      toast.success('Frame added!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(frameId: string) {
    if (!confirm('Delete this frame?')) return;
    try {
      const token = localStorage.getItem('sb_access_token');
      await fetch(`${API_BASE}/api/events/${eventId}/frames/${frameId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      onFramesUpdate(frames.filter(f => f.id !== frameId));
      toast.success('Frame deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleToggleActive(frameId: string, active: boolean) {
    try {
      const token = localStorage.getItem('sb_access_token');
      await fetch(`${API_BASE}/api/events/${eventId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ isActive: active }),
      });
      onFramesUpdate(frames.map(f => f.id === frameId ? { ...f, isActive: active } : f));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSetDefault(frameId: string) {
    try {
      const token = localStorage.getItem('sb_access_token');
      await fetch(`${API_BASE}/api/events/${eventId}/frames/${frameId}/default`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      onFramesUpdate(frames.map(f => ({ ...f, isDefault: f.id === frameId })));
      toast.success('Default frame set');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Photo Frame Overlays</h3>
          <p className="text-zinc-500 text-sm mt-0.5">{frames.length} frames available</p>
        </div>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Frame
        </button>
      </div>

      {adding && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Frame Name</label>
            <input type="text" placeholder="e.g. Gold Border, Neon"
              value={newFrame.name} onChange={e => setNewFrame({...newFrame, name: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Upload PNG (transparency required)</label>
            <label className="w-full h-40 border-2 border-dashed border-zinc-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-violet-500 transition-colors overflow-hidden">
              {newFrame.file ? (
                <img src={URL.createObjectURL(newFrame.file)} className="w-full h-full object-cover" alt="preview" />
              ) : (
                <span className="text-zinc-500 text-sm">Click to upload PNG frame</span>
              )}
              <input type="file" accept="image/png" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setNewFrame({...newFrame, file: f}); }} />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddFrame} disabled={!newFrame.name || !newFrame.file || uploading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              {uploading ? 'Uploading...' : 'Save Frame'}
            </button>
            <button onClick={() => { setAdding(false); setNewFrame({name: '', file: null}); }}
              className="text-zinc-400 hover:text-white px-5 py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {frames.length === 0 && !adding && (
        <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center">
          <Upload className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No frames yet</p>
          <p className="text-zinc-600 text-xs mt-1">Upload PNG overlays that guests can apply to photos during preview</p>
        </div>
      )}

      {frames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {frames.map(frame => (
            <div key={frame.id} className="relative group rounded-xl overflow-hidden border border-zinc-800 aspect-square">
              <img src={frame.url} alt={frame.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => handleToggleActive(frame.id, !frame.isActive)}
                  title={frame.isActive ? 'Hide from booth' : 'Show in booth'}
                  className="bg-black/60 rounded-full p-2 text-white hover:bg-black/80">
                  {frame.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                {!frame.isDefault && (
                  <button onClick={() => handleSetDefault(frame.id)}
                    title="Set as default overlay"
                    className="bg-black/60 rounded-full px-3 py-2 text-white text-xs font-semibold hover:bg-black/80">
                    Default
                  </button>
                )}
                <button onClick={() => handleDelete(frame.id)}
                  className="bg-red-500/20 rounded-full p-2 text-red-300 hover:bg-red-500/40">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {frame.isDefault && (
                <div className="absolute top-2 left-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                  DEFAULT
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <p className="text-white text-xs font-semibold truncate">{frame.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
