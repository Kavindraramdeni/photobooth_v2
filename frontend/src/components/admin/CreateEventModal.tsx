'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { createEvent } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateEventModal({ onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: '',
    venue: '',
    clientName: '',
    clientEmail: '',
    primaryColor: '#7c3aed',
    footerText: '',
    countdownSeconds: 3,
    allowAI: true,
    allowGIF: true,
    allowBoomerang: true,
    allowPrint: true,
    operatorPin: '1234',
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
        branding: {
          primaryColor: form.primaryColor,
          secondaryColor: '#ffffff',
          eventName: form.name,
          footerText: form.footerText || form.name,
          showDate: true,
        },
        settings: {
          countdownSeconds: form.countdownSeconds,
          allowAI: form.allowAI,
          allowGIF: form.allowGIF,
          allowBoomerang: form.allowBoomerang,
          allowPrint: form.allowPrint,
          operatorPin: form.operatorPin,
        },
      });

      toast.success('Event created!');
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create event';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

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
              <label className="block text-white/60 text-sm mb-1.5">Event Name *</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Sarah & John's Wedding"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Event Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Venue</label>
              <input
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder="Grand Ballroom, The Ritz"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Client Name</label>
              <input
                value={form.clientName}
                onChange={(e) => set('clientName', e.target.value)}
                placeholder="John Smith"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          {/* Branding */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="text-white font-medium mb-4">🎨 Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-sm mb-1.5">Brand Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer"
                  />
                  <input
                    value={form.primaryColor}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1.5">Footer Text</label>
                <input
                  value={form.footerText}
                  onChange={(e) => set('footerText', e.target.value)}
                  placeholder="Captured at Sarah & John's Wedding"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="text-white font-medium mb-4">⚙️ Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { key: 'allowAI', label: '🤖 AI Generation' },
                { key: 'allowGIF', label: '🎬 GIF Mode' },
                { key: 'allowBoomerang', label: '🔄 Boomerang' },
                { key: 'allowPrint', label: '🖨️ Print' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[item.key as keyof typeof form] as boolean}
                    onChange={(e) => set(item.key, e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-white/70 text-sm">{item.label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-sm mb-1.5">Countdown (seconds)</label>
                <select
                  value={form.countdownSeconds}
                  onChange={(e) => set('countdownSeconds', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                >
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>{n}s</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1.5">Operator PIN</label>
                <input
                  type="password"
                  value={form.operatorPin}
                  onChange={(e) => set('operatorPin', e.target.value)}
                  placeholder="1234"
                  maxLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-5 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
