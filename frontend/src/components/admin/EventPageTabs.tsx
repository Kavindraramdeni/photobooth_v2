'use client';

import { LayoutDashboard, Palette, Camera, Share2, Printer, Image as ImageIcon, BarChart3, Sparkles, Frame as FrameIcon } from 'lucide-react';

export type Tab = 'overview' | 'branding' | 'capture' | 'aistyles' | 'sharing' | 'print' | 'photos' | 'moderation' | 'leads' | 'analytics' | 'diagnostics' | 'frames' | 'orientation';

export const NAV_STRUCTURE = [
  { section: 'Event',   icon: LayoutDashboard, tabs: [{ key: 'overview' as Tab, label: 'Overview' }] },
  { section: 'Design',  icon: Palette,         tabs: [
    { key: 'branding' as Tab, label: 'Branding' },
    { key: 'frames' as Tab, label: 'Frames' },
    { key: 'orientation' as Tab, label: 'Orientation' }
  ]},
  { section: 'Booth',   icon: Camera,          tabs: [{ key: 'capture' as Tab, label: 'Capture & Modes' }] },
  { section: 'AI',      icon: Sparkles,        tabs: [{ key: 'aistyles' as Tab, label: 'AI Styles' }] },
  { section: 'Share',   icon: Share2,          tabs: [{ key: 'sharing' as Tab, label: 'Sharing & Email' }] },
  { section: 'Print',   icon: Printer,         tabs: [{ key: 'print' as Tab, label: 'Print Setup' }] },
  { section: 'Gallery', icon: ImageIcon,       tabs: [
    { key: 'photos' as Tab, label: 'Photos' },
    { key: 'moderation' as Tab, label: 'Moderation' },
    { key: 'leads' as Tab, label: 'Leads' },
  ]},
  { section: 'Data',    icon: BarChart3,       tabs: [
    { key: 'analytics' as Tab, label: 'Analytics' },
    { key: 'diagnostics' as Tab, label: 'Diagnostics' },
  ]},
];
