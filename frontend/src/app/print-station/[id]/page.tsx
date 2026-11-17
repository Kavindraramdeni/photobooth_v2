'use client';

/**
 * /print-station/[id]/page.tsx
 * SnapBooth Dedicated Tablet Print Station
 * 
 * Placed on an iPad or laptop next to the dye-sub printer (DNP, Citizen, HiTi, AirPrint).
 * - Real-time Socket.IO feed: Newly captured 4x6 cards pop up within 2 seconds.
 * - Touch-optimized guest UI: Guests tap their photo, pick 1 or 2 copies, and hit Print.
 * - Enqueues print jobs to /api/print/queue for local print agents and/or triggers AirPrint.
 * - Frees up the camera kiosk line to maximize event session throughput.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  Printer, Check, RefreshCw, X, Sparkles, Layers,
  ChevronLeft, ArrowRight, ShieldCheck, CheckCircle2,
  AlertCircle, Wifi, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Photo {
  id: string;
  url: string;
  thumb_url?: string;
  gallery_url?: string;
  mode?: string;
  created_at?: string;
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    eventName?: string;
    cardOrientation?: 'portrait' | 'landscape';
  };
  settings?: {
    autoPrint?: boolean;
    printCopies?: number;
    printScale?: number;
    printOffsetX?: number;
    printOffsetY?: number;
  };
}

// ── Native 4x6 / 6x4 Print Execution ──────────────────────────────────────────
function printCardNative(photoUrl: string, isLandscape = false, offsetX = 0, offsetY = 0) {
  const existing = document.getElementById('__snapbooth_print_frame');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__snapbooth_print_frame';
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) { window.open(photoUrl, '_blank'); return; }
  doc.open(); doc.close();
  const style = doc.createElement('style');
  const pageSize = isLandscape ? '6in 4in landscape' : '4in 6in portrait';
  const wrapW = isLandscape ? '6in' : '4in';
  const wrapH = isLandscape ? '4in' : '6in';

  style.textContent = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'html, body { width:100%; height:100%; overflow:hidden; background:#fff; }',
    `@page { margin:0; size:${pageSize}; }`,
    '@media print { html, body { height:auto; overflow:hidden; }',
    '  * { page-break-after:avoid !important; page-break-before:avoid !important; page-break-inside:avoid !important; }',
    '  img { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }',
    `.wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; width:${wrapW}; height:${wrapH}; overflow:hidden; padding:0; margin:0; transform:translate(${offsetX}mm, ${offsetY}mm); }`,
    'img { width:100%; height:100%; object-fit:contain; display:block; }',
  ].join(' ');
  doc.head.appendChild(style);
  const wrap = doc.createElement('div'); wrap.className = 'wrap';
  const img = doc.createElement('img'); img.src = photoUrl; img.alt = 'photo';
  wrap.appendChild(img);
  doc.body.appendChild(wrap);
  function doPrint() { win!.focus(); win!.print(); }
  if (img.complete) { setTimeout(doPrint, 400); } else { img.onload = () => setTimeout(doPrint, 400); }
  setTimeout(() => { document.getElementById('__snapbooth_print_frame')?.remove(); }, 30000);
}

export default function PrintStationPage() {
  const params = useParams();
  const idOrSlug = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [copies, setCopies] = useState<number>(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // 1. Fetch Event & Recent Photos
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const evRes = await fetch(`${API_BASE}/api/events/${idOrSlug}`);
        if (!evRes.ok) throw new Error('Event not found');
        const evData = await evRes.json();
        const ev: EventData = evData.event;
        setEvent(ev);

        const photoRes = await fetch(`${API_BASE}/api/photos/event/${ev.id}?limit=60`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          const visible = (photoData.photos || []).filter((p: Photo) => !(p as any).is_hidden);
          setPhotos(visible);
        }
      } catch (err) {
        console.error('[PrintStation] Load error:', err);
        toast.error('Could not connect to event print hub');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [idOrSlug]);

  // 2. Real-time Socket.IO ingest for instant photo appearance
  useEffect(() => {
    if (!event) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-event', event.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('photo-taken', (newPhoto: { photoId: string; thumbUrl: string; galleryUrl: string; mode?: string }) => {
      setPhotos((prev) => {
        if (prev.some((p) => p.id === newPhoto.photoId)) return prev;
        const fresh: Photo = {
          id: newPhoto.photoId,
          url: newPhoto.galleryUrl || newPhoto.thumbUrl,
          thumb_url: newPhoto.thumbUrl,
          mode: newPhoto.mode,
          created_at: new Date().toISOString(),
        };
        toast.success('New photo ready for print! 📸', { duration: 2500, position: 'bottom-center' });
        return [fresh, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [event]);

  // 3. Handle Print Dispatch
  const handlePrint = async () => {
    if (!event || !selectedPhoto) return;
    setIsPrinting(true);

    const isLandscape = Boolean(
      event?.branding?.cardOrientation === 'landscape' ||
      (selectedPhoto.mode && selectedPhoto.mode.includes('landscape'))
    );

    try {
      // Step A: Send print job to backend queue (for local DNP/Citizen print daemons)
      await fetch(`${API_BASE}/api/print/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          photoId: selectedPhoto.id,
          copies,
          layout: isLandscape ? '6x4' : '4x6',
        }),
      }).catch((e) => console.warn('[PrintStation] Backend queue push warning:', e));

      // Step B: Also trigger native print for AirPrint kiosks
      printCardNative(
        selectedPhoto.url,
        isLandscape,
        Number(event?.settings?.printOffsetX ?? 0),
        Number(event?.settings?.printOffsetY ?? 0)
      );

      setPrintSuccess(true);
      toast.success(`Sent ${copies} ${copies === 1 ? 'copy' : 'copies'} to printer! 🖨️`);

      // Auto-reset modal after 3 seconds
      setTimeout(() => {
        setSelectedPhoto(null);
        setPrintSuccess(false);
        setCopies(1);
      }, 2800);
    } catch (err) {
      console.error('[PrintStation] Print error:', err);
      toast.error('Print request failed');
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6 text-white text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-semibold">Connecting to Print Station…</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c0d1b] via-[#090a14] to-[#140e28] text-white flex flex-col selection:bg-violet-500 selection:text-white">
      {/* ── Apple Liquid Glass Ambient Light blooms ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-violet-600/12 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 -right-20 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[130px]" />
      </div>

      {/* ── Header Bar ── */}
      <header className="relative z-10 px-6 py-4 backdrop-blur-2xl bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white">{event.name}</h1>
            <p className="text-xs text-zinc-400 font-medium">Dedicated 4×6 Print Station</p>
          </div>
        </div>

        {/* Live Hardware & Connection Status Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/12 text-xs font-semibold backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${socketConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="text-zinc-300">DNP 4×6 Dye-Sub Ready</span>
          </div>
        </div>
      </header>

      {/* ── Main Photo Touch Feed ── */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Select Your Photo to Print</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Tap any 4×6 commemorative card below to print glossy souvenir copies instantly.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono font-bold bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/10">
            {photos.length} Captured Cards
          </span>
        </div>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-zinc-500">
            <Clock className="w-12 h-12 mb-3 text-violet-400/50 animate-pulse" />
            <h3 className="text-base font-bold text-zinc-300 mb-1">Waiting for booth captures…</h3>
            <p className="text-xs max-w-sm">Take a photo in the camera booth, and it will appear here in real-time ready to print.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo, idx) => (
              <motion.button
                key={photo.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.4) }}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-violet-500/60 bg-zinc-900/40 backdrop-blur-xl aspect-[2/3] transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/20 active:scale-95 text-left flex flex-col"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumb_url || photo.url}
                  alt="Captured Card"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="w-full py-2 rounded-xl bg-violet-600 text-white font-bold text-xs text-center shadow-lg">
                    🖨️ Tap to Print
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      {/* ── Touch Print Modal ── */}
      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg bg-zinc-900/95 border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-5 text-white"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center pt-2">
                <h3 className="font-extrabold text-xl">Print Souvenir Card</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Calibrated for 4×6 Dye-Sub Glossy Paper</p>
              </div>

              {/* Photo Preview Frame */}
              <div className="relative mx-auto max-h-[340px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.url}
                  alt="Selected Card"
                  className="max-h-[340px] w-auto object-contain"
                />
              </div>

              {printSuccess ? (
                /* Success Confirmation */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-1.5"
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="font-bold text-sm text-white">Printing in Progress!</p>
                  <p className="text-xs text-emerald-300">Please collect your glossy 4×6 photo from the printer tray.</p>
                </motion.div>
              ) : (
                /* Copies Selector & Print Button */
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="text-xs text-zinc-400 font-semibold block mb-2 text-center uppercase tracking-wider">
                      Number of Copies
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                      {[1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCopies(num)}
                          className={`py-3 rounded-2xl text-sm font-bold transition-all border ${
                            copies === num
                              ? 'bg-violet-600 text-white border-violet-400 shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                          }`}
                        >
                          {num} {num === 1 ? 'Copy' : 'Copies'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPrinting}
                    onClick={handlePrint}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white font-extrabold text-base transition-all shadow-xl shadow-violet-600/30 flex items-center justify-center gap-2.5 active:scale-[0.98]"
                  >
                    {isPrinting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Sending to Printer…
                      </>
                    ) : (
                      <>
                        <Printer className="w-5 h-5" />
                        Print {copies} {copies === 1 ? 'Copy' : 'Copies'} Now
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
