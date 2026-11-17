'use client';

import React from 'react';
import { Rocket, Camera, Palette, Printer, Shield } from 'lucide-react';

export type HubId = 'live' | 'booth' | 'design' | 'delivery' | 'photos';

interface HubDefinition {
  id: HubId;
  label: string;
  mobileLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const HUBS: HubDefinition[] = [
  { id: 'live',     label: 'Live Ops',       mobileLabel: 'Live',     Icon: Rocket  },
  { id: 'booth',    label: 'Booth & Camera', mobileLabel: 'Booth',    Icon: Camera  },
  { id: 'design',   label: 'Design',         mobileLabel: 'Design',   Icon: Palette },
  { id: 'delivery', label: 'Print & Delivery',mobileLabel: 'Delivery',Icon: Printer },
  { id: 'photos',   label: 'Photos',         mobileLabel: 'Photos',   Icon: Shield  },
];

interface HubNavigationBarProps {
  activeHub: HubId;
  onHubChange: (hub: HubId) => void;
  dirtyHubs?: Set<HubId>;
}

export default function HubNavigationBar({ activeHub, onHubChange, dirtyHubs }: HubNavigationBarProps) {
  return (
    <>
      {/* ── Desktop / Tablet: Apple Liquid Glass pill dock ──────────────────── */}
      <nav className="hidden sm:flex items-center gap-1.5 p-1.5 backdrop-blur-2xl bg-white/[0.05] border border-white/12 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ring-1 ring-inset ring-white/[0.05]">
        {HUBS.map(({ id, label, Icon }) => {
          const isActive = activeHub === id;
          const isDirty = dirtyHubs?.has(id);
          return (
            <button
              key={id}
              onClick={() => onHubChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-2 px-3.5 md:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex-1 justify-center whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 border border-white/25 ring-1 ring-white/10'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{label.split(' ')[0]}</span>
              {isDirty && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Mobile: fixed bottom dock with Apple Liquid Glass ───────────────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch backdrop-blur-2xl bg-zinc-950/90 border-t border-white/12 shadow-2xl safe-area-pb">
        {HUBS.map(({ id, mobileLabel, Icon }) => {
          const isActive = activeHub === id;
          const isDirty = dirtyHubs?.has(id);
          return (
            <button
              key={id}
              onClick={() => onHubChange(id)}
              aria-current={isActive ? 'page' : undefined}
              style={{ minHeight: 56 }}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors duration-150 ${
                isActive ? 'text-violet-400' : 'text-zinc-500'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-2 h-0.5 rounded-full bg-violet-500" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{mobileLabel}</span>
              {isDirty && (
                <span className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer so mobile content isn't obscured by bottom dock */}
      <div className="sm:hidden h-14" aria-hidden="true" />
    </>
  );
}
