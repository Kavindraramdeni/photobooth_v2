'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, ExternalLink, Tablet, Smartphone, Camera,
  Image as ImageIcon, Sparkles, Share2, CheckCircle2, QrCode
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
  const [simScreen, setSimScreen] = useState<'idle' | 'capture' | 'preview' | 'share'>('idle');

  const primaryColor = String(branding['primaryColor'] ?? '#8b5cf6');
  const secondaryColor = String(branding['secondaryColor'] ?? '#c084fc');
  const logoUrl = String(branding['logoUrl'] ?? '');
  const footerText = String(branding['footerText'] ?? 'SnapBooth Experience');
  const frameUrl = String(branding['frameUrl'] ?? '');

  const samplePhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="sticky top-6 flex flex-col items-center">
      {/* Simulator Control Header */}
      <div className="w-full flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold text-xs uppercase tracking-wider">Live Kiosk Simulator</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation(o => (o === 'portrait' ? 'landscape' : 'portrait'))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl glass-pill text-xs font-semibold text-white/80 hover:text-white transition-all active:scale-95"
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all"
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Virtual Device Frame (iPad Pro Style) */}
      <div
        className={`relative transition-all duration-500 ease-out p-3.5 sm:p-4 rounded-[40px] bg-[#1a1a24] border-4 border-[#2d2d3d] shadow-[0_24px_70px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] ${
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
          <div className="w-2.5 h-2.5 rounded-full bg-[#0d0d12] border border-white/10" />
        </div>

        {/* Screen Bezel Inside */}
        <div className="w-full h-full rounded-[28px] overflow-hidden relative bg-[#07070d] flex flex-col border border-white/5 shadow-inner">
          {/* Status Bar */}
          <div className="h-6 px-4 flex items-center justify-between text-[10px] text-white/40 font-mono flex-shrink-0 bg-black/40 z-20">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-4 h-2 rounded-sm border border-white/40 p-0.5">
                <div className="w-full h-full bg-white/60 rounded-xs" />
              </div>
            </div>
          </div>

          {/* Screen Content Switcher */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {/* 1. IDLE SCREEN SIMULATION */}
              {simScreen === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-between p-4 relative"
                >
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ background: `radial-gradient(circle at center, ${primaryColor} 0%, transparent 70%)` }}
                  />

                  {/* Top gear */}
                  <div className="w-full flex justify-end">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px]">⚙️</div>
                  </div>

                  {/* Brand Branding */}
                  <div className="text-center z-10">
                    {logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain mx-auto mb-2 drop-shadow" />
                    ) : (
                      <h4 className="text-white font-black text-base drop-shadow">{eventName}</h4>
                    )}
                    <p className="text-white/40 text-[10px] font-medium">Touch to Start</p>
                  </div>

                  {/* Modes Grid Preview */}
                  <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] z-10 mb-2">
                    {['Photo', '4-Strip', 'AI Magic'].map((m, idx) => (
                      <div
                        key={m}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-center flex flex-col items-center justify-center gap-1 shadow-sm"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white"
                          style={{ background: idx === 0 ? primaryColor : idx === 1 ? secondaryColor : '#10b981' }}
                        >
                          {idx === 0 ? '📷' : idx === 1 ? '🎞️' : '✨'}
                        </div>
                        <span className="text-[9px] font-bold text-white/90">{m}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-white/30 text-[9px] tracking-wider uppercase">SnapBooth Kiosk</p>
                </motion.div>
              )}

              {/* 2. CAPTURE / COUNTDOWN SIMULATION */}
              {simScreen === 'capture' && (
                <motion.div
                  key="capture"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative flex items-center justify-center bg-zinc-950"
                >
                  {/* Fake Camera Feed */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={samplePhotoUrl} alt="Feed" className="absolute inset-0 w-full h-full object-cover opacity-60" />

                  {/* Viewfinder brackets */}
                  <div className="absolute inset-4 border border-white/20 rounded-2xl pointer-events-none" />

                  {/* Circular countdown ring */}
                  <div className="relative flex items-center justify-center z-10">
                    <div
                      className="w-16 h-16 rounded-full border-2 flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-xl"
                      style={{ borderColor: primaryColor }}
                    >
                      <span className="text-2xl font-black text-white">3</span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="text-[10px] font-bold text-white bg-black/50 px-2 py-0.5 rounded-full">
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
                  className="w-full h-full flex flex-col p-3 bg-black relative"
                >
                  <div className="flex-1 relative flex items-center justify-center min-h-0">
                    <div className="relative rounded-xl overflow-hidden border border-white/20 shadow-xl max-h-full">
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
                    <div className="p-1.5 rounded-lg bg-white/10 text-center text-[9px] font-bold text-white">
                      🪄 Filters
                    </div>
                    <div
                      className="p-1.5 rounded-lg text-center text-[9px] font-bold text-white shadow-sm"
                      style={{ background: primaryColor }}
                    >
                      📱 Get Photo
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/10 text-center text-[9px] font-bold text-white">
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
                  className="w-full h-full flex flex-col items-center justify-center p-3 relative bg-[#07070d]"
                >
                  <div className="bg-white p-2.5 rounded-xl shadow-lg mb-2">
                    <QRCodeSVG value="https://snapbooth.ai" size={80} level="M" />
                  </div>
                  <p className="text-[10px] font-bold text-white">Scan to Save Photo</p>
                  <p className="text-[8px] text-white/40 mb-3">Instant download to phone</p>

                  <div className="grid grid-cols-2 gap-1.5 w-full max-w-[200px]">
                    <div className="py-1 rounded-md bg-[#25D366] text-white text-[8px] font-bold text-center">
                      WhatsApp
                    </div>
                    <div className="py-1 rounded-md bg-sky-600 text-white text-[8px] font-bold text-center">
                      AirDrop
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* iPad Bottom Interactive Simulator Switcher */}
          <div className="h-9 bg-black/80 border-t border-white/10 px-2 flex items-center justify-around flex-shrink-0 z-20">
            {[
              { id: 'idle', label: 'Idle' },
              { id: 'capture', label: 'Camera' },
              { id: 'preview', label: 'Photo' },
              { id: 'share', label: 'Share' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSimScreen(tab.id as any)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                  simScreen === tab.id
                    ? 'bg-purple-600 text-white'
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
