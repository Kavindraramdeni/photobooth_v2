'use client';

/**
 * PrintLayoutModal
 * Full print layout editor with portrait/landscape, 1-up / 2-up / 4-up strip layouts.
 * Uses a hidden iframe + DOM-built print document. No template literals in TSX.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type Layout = '1up' | '2up' | '4up' | 'strip';
type Orientation = 'portrait' | 'landscape';

interface PrintLayoutModalProps {
  photo: { url: string; mode?: string };
  eventName: string;
  primaryColor: string;
  onClose: () => void;
}

const LAYOUTS: { id: Layout; label: string; icon: string; desc: string }[] = [
  { id: '1up',   label: '1 Photo',    icon: '▭',  desc: 'Full page' },
  { id: '2up',   label: '2 Photos',   icon: '▭▭', desc: '2 copies on one page' },
  { id: '4up',   label: '4 Photos',   icon: '▦',  desc: '4 wallet-size prints' },
  { id: 'strip', label: 'Strip',      icon: '▮',  desc: '3 vertical strips' },
];

function buildPrintDocument(
  doc: Document,
  photoUrl: string,
  eventName: string,
  layout: Layout,
  orientation: Orientation,
  showDate: boolean,
  showEventName: boolean,
  primaryColor: string,
) {
  const pageSize = orientation === 'portrait' ? '6in 4in' : '4in 6in';
  const cols = layout === '4up' ? 2 : layout === '2up' ? 2 : layout === 'strip' ? 3 : 1;
  const rows = layout === '4up' ? 2 : 1;

  const style = doc.createElement('style');
  const css = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'html,body { width:100%; height:100%; background:#fff; }',
    `@page { margin:0.25cm; size:${pageSize} ${orientation}; }`,
    '@media print { .no-print { display:none; } img { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }',
    `.grid { display:grid; grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr);`,
    '  width:100%; height:100vh; gap:4px; padding:4px; }',
    '.cell { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; overflow:hidden; }',
    '.cell img { width:100%; flex:1; object-fit:cover; display:block; border-radius:2px; }',
    '.footer { font-size:7pt; color:#666; text-align:center; white-space:nowrap; overflow:hidden; }',
    `.event-name { font-size:8pt; font-weight:bold; color:${primaryColor}; }`,
    '.date { font-size:6.5pt; color:#999; }',
    /* Strip: rotate grid for vertical layout */
    layout === 'strip' ? '.grid { grid-template-columns: repeat(3, 1fr); height:100vh; }' : '',
  ].filter(Boolean).join(' ');
  style.textContent = css;
  doc.head.appendChild(style);

  const grid = doc.createElement('div');
  grid.className = 'grid';

  const count = cols * rows;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  for (let i = 0; i < count; i++) {
    const cell = doc.createElement('div');
    cell.className = 'cell';

    const img = doc.createElement('img');
    img.src = photoUrl;
    img.alt = 'photo';
    cell.appendChild(img);

    if (showEventName || showDate) {
      const footer = doc.createElement('div');
      footer.className = 'footer';
      if (showEventName) {
        const en = doc.createElement('div');
        en.className = 'event-name';
        en.textContent = eventName;
        footer.appendChild(en);
      }
      if (showDate) {
        const d = doc.createElement('div');
        d.className = 'date';
        d.textContent = dateStr;
        footer.appendChild(d);
      }
      cell.appendChild(footer);
    }

    grid.appendChild(cell);
  }

  doc.body.appendChild(grid);
}

export function PrintLayoutModal({ photo, eventName, primaryColor, onClose }: PrintLayoutModalProps) {
  const [layout, setLayout]           = useState<Layout>('1up');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [showDate, setShowDate]       = useState(true);
  const [showEventName, setShowEventName] = useState(true);
  const [printing, setPrinting]       = useState(false);

  async function handlePrint() {
    setPrinting(true);
    try {
      const existing = document.getElementById('__sb_print_frame');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = '__sb_print_frame';
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = iframe.contentDocument || win?.document;
      if (!doc || !win) { window.open(photo.url, '_blank'); return; }

      doc.open(); doc.close();

      buildPrintDocument(doc, photo.url, eventName, layout, orientation, showDate, showEventName, primaryColor);

      const firstImg = doc.querySelector('img') as HTMLImageElement | null;
      const doPrint = () => { win!.focus(); win!.print(); };

      if (firstImg?.complete) { setTimeout(doPrint, 400); }
      else if (firstImg) { firstImg.onload = () => setTimeout(doPrint, 400); }
      else { setTimeout(doPrint, 400); }

      setTimeout(() => { document.getElementById('__sb_print_frame')?.remove(); }, 30000);
      toast.success('Print dialog opened!');
    } finally {
      setTimeout(() => setPrinting(false), 2000);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-[#141420] rounded-3xl w-full max-w-sm overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Layout
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Preview */}
          <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="preview" className="w-16 h-16 object-cover rounded-xl" />
            <div>
              <p className="text-white text-sm font-semibold">{eventName}</p>
              <p className="text-white/40 text-xs mt-0.5">Print layout: {layout} · {orientation}</p>
            </div>
          </div>

          {/* Layout selection */}
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Layout</p>
            <div className="grid grid-cols-4 gap-2">
              {LAYOUTS.map(l => (
                <button key={l.id} onClick={() => setLayout(l.id)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all text-xs font-medium ${
                    layout === l.id
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                  }`}>
                  <span className="text-base">{l.icon}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Orientation */}
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Orientation</p>
            <div className="grid grid-cols-2 gap-2">
              {(['portrait', 'landscape'] as Orientation[]).map(o => (
                <button key={o} onClick={() => setOrientation(o)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all text-sm font-medium capitalize ${
                    orientation === o
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                  }`}>
                  <span>{o === 'portrait' ? '▯' : '▭'}</span>
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Options</p>
            {[
              { label: 'Show event name', value: showEventName, set: setShowEventName },
              { label: 'Show date',       value: showDate,      set: setShowDate },
            ].map(({ label, value, set }) => (
              <button key={label} onClick={() => set(!value)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors">
                <span className="text-white/70 text-sm">{label}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${value ? 'bg-purple-500' : 'bg-white/15'}`}>
                  {value && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))}
          </div>

          {/* Print button */}
          <button onClick={handlePrint} disabled={printing}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all disabled:opacity-70"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
            <Printer className="w-5 h-5" />
            {printing ? 'Opening printer…' : 'Print'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
