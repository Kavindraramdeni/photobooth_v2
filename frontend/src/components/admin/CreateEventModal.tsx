'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { createEvent } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateEventModal({ onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: '',
    venue: '',
    clientName: '',
    clientEmail: '',
    guestCount: '',
    notes: '',
    primaryColor: '#7c3aed',
    footerText: '',
    countdownSeconds: 3,
    sessionTimeout: 60,
    allowAI: true,
    allowGIF: true,
    allowBoomerang: true,
    allowPrint: true,
    allowRetakes: true,
    leadCapture: false,
    operatorPin: '1234',
    photosPerSession: 1,
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name || !form.date) {
      toast.error('Event name and date are required');
      return;
    }

    setLoading(true);
    try {
      await createEvent({
        name: form.name,
        date: form.date,
        venue: form.venue,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        guestCount: form.guestCount ? Number(form.guestCount) : null,
        notes: form.notes,
        branding: {
          primaryColor: form.primaryColor,
          eventName: form.name,
          footerText: form.footerText || form.name,
          showDate: true,
        },
        settings: {
          countdownSeconds: form.countdownSeconds,
          sessionTimeout: form.sessionTimeout,
          allowAI: form.allowAI,
          allowGIF: form.allowGIF,
          allowBoomerang: form.allowBoomerang,
          allowPrint: form.allowPrint,
          allowRetakes: form.allowRetakes,
          leadCapture: form.leadCapture,
          operatorPin: form.operatorPin,
          photosPerSession: form.photosPerSession,
        },
      });

      toast.success('Event created!');
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors';
  const labelCls = 'block text-white/60 text-sm mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create New Event</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Event Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Sarah & John's Wedding" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Event Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <input value={form.venue} onChange={e => set('venue', e.target.value)}
                placeholder="Grand Ballroom, The Ritz" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expected Guests</label>
              <input type="number" value={form.guestCount} onChange={e => set('guestCount', e.target.value)}
                placeholder="150" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Client Name</label>
              <input value={form.clientName} onChange={e => set('clientName', e.target.value)}
                placeholder="John Smith" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Client Email</label>
              <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)}
                placeholder="john@example.com" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes (internal)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Venue access code: 1234 · Setup at 5pm · Contact: +1 555 0100"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none" />
          </div>

          {/* Branding */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="text-white font-medium mb-4">🎨 Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Brand Color</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer p-1 flex-shrink-0" />
                  <input value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Footer Text (on photos)</label>
                <input value={form.footerText} onChange={e => set('footerText', e.target.value)}
                  placeholder="Captured at Sarah & John's Wedding" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Quick Settings */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="text-white font-medium mb-4">⚙️ Features</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'allowAI', label: '🤖 AI Filters' },
                { key: 'allowGIF', label: '🎬 GIF Mode' },
                { key: 'allowBoomerang', label: '🔄 Boomerang' },
                { key: 'allowPrint', label: '🖨️ Print' },
                { key: 'allowRetakes', label: '🔁 Retakes' },
                { key: 'leadCapture', label: '📧 Lead Capture' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form[item.key as keyof typeof form] as boolean}
                    onChange={e => set(item.key, e.target.checked)}
                    className="w-4 h-4 accent-purple-500" />
                  <span className="text-white/70 text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced settings toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide' : 'Show'} advanced settings
          </button>

          {showAdvanced && (
            <div className="border-t border-white/10 pt-5 space-y-4">
              <h3 className="text-white font-medium">🎛️ Advanced</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Countdown (s)</label>
                  <select value={form.countdownSeconds} onChange={e => set('countdownSeconds', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Session Timeout</label>
                  <select value={form.sessionTimeout} onChange={e => set('sessionTimeout', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[30, 60, 90, 120, 180].map(n => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Photos / Session</label>
                  <select value={form.photosPerSession} onChange={e => set('photosPerSession', Number(e.target.value))}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className={labelCls}>Operator PIN</label>
                  <input value={form.operatorPin} onChange={e => set('operatorPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="1234" maxLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono tracking-widest placeholder-white/30 focus:outline-none focus:border-purple-500" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-5 border-t border-white/10">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
