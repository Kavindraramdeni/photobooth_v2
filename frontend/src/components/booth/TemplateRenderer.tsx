'use client';

import type { ReactNode } from 'react';

export interface BoothTemplate {
  name?: string;
  layout?: {
    borderColor?: string;
    backgroundColor?: string;
    footerText?: string;
    logoUrl?: string | null;
  };
}

export function TemplateRenderer({ photoUrl, eventName, template, children }: { photoUrl: string; eventName: string; template?: BoothTemplate | null; children?: ReactNode }) {
  const layout = template?.layout || {};
  return <div className="relative overflow-hidden rounded-[2rem] p-3 shadow-2xl" style={{ background: layout.backgroundColor || '#111827', border: `6px solid ${layout.borderColor || '#ffffff'}` }}>
    {layout.logoUrl && <img src={layout.logoUrl} alt="Event logo" className="absolute left-4 top-4 z-10 h-14 w-14 rounded-full object-contain bg-white/90 p-1" />}
    {photoUrl ? (
      <img src={photoUrl} alt="Captured photo" className="max-h-[70vh] w-full rounded-2xl object-contain" />
    ) : (
      <div className="w-full h-80 flex items-center justify-center bg-black/50 text-white/40 text-sm font-semibold rounded-2xl">
        Camera preview unavailable
      </div>
    )}
    <div className="mt-3 text-center text-sm font-bold text-white">{layout.footerText || eventName}</div>
    {children}
  </div>;
}
