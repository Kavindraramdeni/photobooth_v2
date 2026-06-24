'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { createTemplate } from '@/lib/api';

export function TemplateDesigner({ eventId }: { eventId: string }) {
  const [name, setName] = useState('Classic Print Template');
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [backgroundColor, setBackgroundColor] = useState('#111827');

  async function save() {
    try {
      await createTemplate(eventId, { name, layout: { borderColor, backgroundColor } });
      toast.success('Template saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Template save failed');
    }
  }

  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <h3 className="mb-3 text-lg font-bold text-white">Template Designer</h3>
    <input className="mb-3 w-full rounded-xl px-3 py-2 text-gray-950" value={name} onChange={(e) => setName(e.target.value)} />
    <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-white/80">
      <label>Border <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="ml-2" /></label>
      <label>Background <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="ml-2" /></label>
    </div>
    <button onClick={save} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white">Save template</button>
  </div>;
}
