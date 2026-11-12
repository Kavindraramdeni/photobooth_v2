'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, ExternalLink, Tablet, Smartphone, Camera,
  Image as ImageIcon, Sparkles, Share2, CheckCircle2, QrCode, Sun, Moon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface LiveKioskSimulatorProps {
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  eventName: string;
  slug: string;
}

export function LiveKioskSimulator({
  branding,
  settings,
  eventName,
  slug,
}: LiveKioskSimulatorProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [simScreen, setSimScreen] = useState<'idle' | 'style' | 'capture' | 'preview' | 'share'>('idle');

  const primaryColor = String(branding['primaryColor'] ?? '#7c3aed');
  const secondaryColor = String(branding['secondaryColor'] ?? '#a855f7');
  const logoUrl = String(branding['logoUrl'] ?? '');
  const footerText = String(branding['footerText'] ?? 'SnapBooth Experience');
  const frameUrl = String(branding['frameUrl'] ?? '');
  const wallpaperUrl = String(branding['wallpaperUrl'] ?? branding['idleMediaUrl'] ?? '');
  const themeMode = String(branding['themeMode'] ?? 'light');

  const isLight = themeMode !== 'dark';
  const samplePhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="sticky top-6 flex flex-col items-center">
      {/* Simulator Control Header */}
      <div className="w-full flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-800 dark:text-white font-black text-xs uppercase tracking-wider">Live Kiosk Simulator</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation(o => (o === 'portrait' ? 'landscape' : 'portrait'))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl glass-crystal-pill text-xs font-bold text-slate-700 dark:text-white/80 hover:text-purple-600 transition-all active:scale-95 shadow-sm"
            title="Rotate iPad"
          >
            {orientation === 'portrait' ? <Tablet className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 rotate-90" />}
            <span className="capitalize">{orientation}</span>
          </button>

          {/* Direct Booth Link */}
          <a
            href={`/booth?event=${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 text-white hover:bg-purple-500 text-xs font-bold transition-all shadow-sm"
          >
            <span>Open Booth</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Virtual Device Frame (iPad Pro Style) */}
      <div
        className={`relative transition-all duration-500 ease-out p-3.5 sm:p-4 rounded-[42px] ${
          isLight
            ? 'bg-[#e2e8f0] border-4 border-[#cbd5e1] shadow-[0_24px_70px_-15px_rgba(0,0,0,0.15)]'
            : 'bg-[#1a1a24] border-4 border-[#2d2d3d] shadow-[0_24px_70px_-15px_rgba(0,0,0,0.8)]'
        } ${
          orientation === 'portrait'
            ? 'w-[320px] sm:w-[350px] h-[520px] sm:h-[570px]'
            : 'w-[480px] sm:w-[540px] h-[340px] sm:h-[370px]'
        }`}
      >
        {/* iPad Top Camera Notch */}
        <div
          className={`absolute z-30 flex items-center justify-center ${
            orientation === 'portrait'
              ? 'top-1.5 left-1/2 -translate-x-1/2 w-16 h-3'
              : 'left-1.5 top-1/2 -translate-y-1/2 h-16 w-3'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white/20" />
        </div>

        {/* Screen Bezel Inside */}
        <div
          className={`w-full h-full rounded-[30px] overflow-hidden relative flex flex-col border shadow-inner ${
            isLight
              ? 'bg-gradient-to-b from-[#ffffff] via-[#f8fafd] to-[#eef2f8] text-slate-900 border-black/5'
              : 'bg-[#07070d] text-white border-white/5'
          }`}
        >
          {/* Wallpaper Layer inside Simulator */}
          {wallpaperUrl && (
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wallpaperUrl} alt="" className="w-full h-full object-cover" />
              <div
                className={`absolute inset-0 ${
                  isLight ? 'bg-white/60 backdrop-blur-[4px]' : 'bg-black/60 backdrop-blur-[4px]'
                }`}
              />
            </div>
          )}

          {/* Status Bar */}
          <div
            className={`h-6 px-4 flex items-center justify-between text-[10px] font-mono flex-shrink-0 z-20 ${
              isLight ? 'text-slate-500 bg-white/40' : 'text-white/40 bg-black/40'
            }`}
          >
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-4 h-2 rounded-sm border border-current p-0.5">
                <div className="w-full h-full bg-current rounded-xs" />
              </div>
            </div>
          </div>

          {/* Screen Content Switcher */}
          <div className="flex-1 relative overflow-hidden flex flex-col z-10">
            <AnimatePresence mode="wait">
              {/* 1. IDLE / ATTRACT SCREEN */}
              {simScreen === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-center p-4 text-center relative"
                >
                  <div className="flex flex-col items-center justify-center space-y-6 my-auto">
                    {logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoUrl} alt="Logo" className="h-12 max-w-[140px] object-contain mx-auto drop-shadow" />
                    ) : (
                      <h4 className="font-black text-xl tracking-tight leading-tight drop-shadow-sm">{eventName}</h4>
                    )}

                    {/* One Huge Pill Button: “Tap to start” */}
                    <div
                      className="px-6 py-3 rounded-full font-black text-xs text-white uppercase tracking-wider shadow-lg animate-pulse"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Tap to start
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. CHOOSE YOUR STYLE */}
              {simScreen === 'style' && (
                <motion.div
                  key="style"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-between p-3.5 text-center relative"
                >
                  <div className="pt-2">
                    <h5 className="font-black text-sm tracking-tight">Choose your style</h5>
                    <p className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tap to pose</p>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 w-full my-auto">
                    {[
                      { label: 'Photo', sub: 'Single shot', icon: '📷' },
                      { label: 'Strip', sub: '4-pose strip', icon: '🎞️' },
                      { label: 'AI', sub: 'Magic art', icon: '✨' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`p-2.5 rounded-2xl flex flex-col items-center justify-center text-center shadow-md border ${
                          isLight ? 'bg-white border-slate-200' : 'bg-[#181938] border-slate-700'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs mb-1.5 shadow-sm"
                          style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                        >
                          {item.icon}
                        </div>
                        <span className="text-[10px] font-black leading-tight">{item.label}</span>
                        <span className={`text-[7px] font-semibold mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.sub}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={`text-[8px] font-bold pb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    ← Back to start
                  </div>
                </motion.div>
              )}

              {/* 2. CAPTURE / COUNTDOWN SIMULATION */}
              {simScreen === 'capture' && (
                <motion.div
                  key="capture"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative flex items-center justify-center bg-black"
                >
                  {/* Fake Camera Feed */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={samplePhotoUrl} alt="Feed" className="absolute inset-0 w-full h-full object-cover opacity-75" />

                  {/* Viewfinder brackets */}
                  <div className="absolute inset-4 border border-white/30 rounded-2xl pointer-events-none" />

                  {/* Circular countdown ring */}
                  <div className="relative flex items-center justify-center z-10">
                    <div
                      className="w-16 h-16 rounded-full border-4 flex items-center justify-center bg-white/20 backdrop-blur-md shadow-2xl"
                      style={{ borderColor: primaryColor }}
                    >
                      <span className="text-2xl font-black text-white drop-shadow">3</span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="text-[10px] font-bold text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                      Smile for the Camera! 😊
                    </span>
                  </div>
                </motion.div>
              )}

              {/* 3. PHOTO PREVIEW SIMULATION */}
              {simScreen === 'preview' && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col p-3 relative"
                >
                  <div className="flex-1 relative flex items-center justify-center min-h-0">
                    <div className="relative rounded-2xl overflow-hidden shadow-xl max-h-full border border-black/10 dark:border-white/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={samplePhotoUrl} alt="Preview" className="w-full h-full object-contain max-h-[220px]" />

                      {/* Applied Frame Overlay Preview */}
                      {frameUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={frameUrl} alt="Overlay" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                      )}

                      {/* Footer text watermark preview */}
                      {footerText && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs py-0.5 px-2 text-center">
                          <p className="text-[8px] font-bold text-white truncate">{footerText}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons simulated */}
                  <div className="mt-2 grid grid-cols-3 gap-1.5 flex-shrink-0">
                    <div className={`p-1.5 rounded-xl text-center text-[9px] font-bold shadow-sm ${
                      isLight ? 'bg-white/90 text-slate-800 border border-black/5' : 'bg-white/10 text-white'
                    }`}>
                      🪄 Filters
                    </div>
                    <div
                      className="p-1.5 rounded-xl text-center text-[9px] font-black text-white shadow-md btn-arcade"
                      style={{ background: primaryColor }}
                    >
                      📱 Get Photo
                    </div>
                    <div className={`p-1.5 rounded-xl text-center text-[9px] font-bold shadow-sm ${
                      isLight ? 'bg-white/90 text-slate-800 border border-black/5' : 'bg-white/10 text-white'
                    }`}>
                      🔄 Retake
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 4. SHARE SCREEN SIMULATION */}
              {simScreen === 'share' && (
                <motion.div
                  key="share"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-center p-3 relative"
                >
                  <div className="bg-white p-3 rounded-2xl shadow-xl mb-2 border border-black/5 ring-4 ring-purple-500/20">
                    <QRCodeSVG value="https://photobooth-v2-ten.vercel.app" size={80} level="M" fgColor="#07070d" />
                  </div>
                  <p className="text-[10px] font-black">Scan to Save Photo</p>
                  <p className={`text-[8px] mb-3 ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                    Instant download to phone
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 w-full max-w-[200px]">
                    <div className="py-1.5 rounded-xl bg-[#25D366] text-white text-[8px] font-black text-center shadow-sm">
                      WhatsApp
                    </div>
                    <div className="py-1.5 rounded-xl bg-sky-600 text-white text-[8px] font-black text-center shadow-sm">
                      AirDrop
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* iPad Bottom Interactive Simulator Switcher */}
          <div
            className={`h-9 border-t px-2 flex items-center justify-around flex-shrink-0 z-20 ${
              isLight ? 'bg-white/80 border-black/5' : 'bg-black/80 border-white/10'
            }`}
          >
            {[
              { id: 'idle', label: 'Idle' },
              { id: 'style', label: 'Style' },
              { id: 'capture', label: 'Camera' },
              { id: 'preview', label: 'Photo' },
              { id: 'share', label: 'Share' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSimScreen(tab.id as any)}
                className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${
                  simScreen === tab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
