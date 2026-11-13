'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { uploadPhoto, createGIF, createStrip } from '@/lib/api';
import { queueOfflinePhoto, removeQueuedPhoto, OfflinePhotoRecord } from '@/lib/offlineQueue';
import toast from 'react-hot-toast';
import { Sparkles, Camera, ArrowLeft } from 'lucide-react';
import { ARPropsOverlay, PROP_CATALOG } from './ARPropsOverlay';

// ── Web Audio API sounds ─────────────────────────────────────────────────────
function playBeep(frequency = 880, duration = 0.12, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), duration * 1000 + 100);
  } catch { /* audio not supported */ }
}

function playShutter() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.45;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    setTimeout(() => ctx.close(), 200);
  } catch { /* audio not supported */ }
}

const STRIP_COUNT = 4;
const GIF_COUNT = 6;
const BOOMERANG_COUNT = 5;

export function CountdownScreen() {
  const {
    event, mode, sessionId,
    setScreen, setCurrentPhoto,
    clearFrames,
    setProcessing, triggerFlash,
  } = useBoothStore();

  const webcamRef = useRef<Webcam>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'capturing' | 'processing'>('ready');
  const [shotsTaken, setShotsTaken] = useState(0);

  // Camera warm-up
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const shouldReduceMotion = useReducedMotion();

  // AR Digital Props & Glam Mode States
  const [activePropId, setActivePropId] = useState<string | null>(null);

  const enableDigitalProps = (event?.settings as Record<string, unknown>)?.enableDigitalProps !== false;
  const glamMode = String((event?.settings as Record<string, unknown>)?.glamMode ?? 'off');

  const glamFilterStyle =
    glamMode === 'kardashian_bw'
      ? 'grayscale(100%) contrast(128%) brightness(108%)'
      : glamMode === 'hollywood_glow'
      ? 'sepia(22%) contrast(110%) brightness(106%) saturate(118%)'
      : '';

  const totalShots = mode === 'strip' ? STRIP_COUNT : mode === 'gif' ? GIF_COUNT : mode === 'boomerang' ? BOOMERANG_COUNT : 1;
  const countdownSeconds = event?.settings?.countdownSeconds ?? 3;
  const soundEnabled = (event?.settings?.countdownSound as boolean) !== false;
  const roamingMode = (event?.settings?.roamingMode as boolean) ?? false;

  const captureFrame = useCallback((): Blob | null => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return null;

    const arr = imageSrc.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  }, []);

  // Composite captured frame with the event frame overlay AND active AR prop
  const compositeWithFrame = useCallback(async (blob: Blob): Promise<Blob> => {
    const frameUrl = event?.branding?.frameUrl as string | null | undefined;
    const prop = activePropId ? PROP_CATALOG.find((p) => p.id === activePropId) : null;

    if (!frameUrl && !prop) return blob;

    return new Promise((resolve) => {
      const photo = new Image();
      photo.crossOrigin = 'anonymous';

      photo.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = photo.naturalWidth;
        canvas.height = photo.naturalHeight;
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(photo, 0, 0);

        const applyFrame = () => {
          if (frameUrl) {
            const frame = new Image();
            frame.crossOrigin = 'anonymous';
            frame.onload = () => {
              ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
              canvas.toBlob((composited) => resolve(composited || blob), 'image/jpeg', 0.95);
            };
            frame.onerror = () => {
              canvas.toBlob((composited) => resolve(composited || blob), 'image/jpeg', 0.95);
            };
            frame.src = frameUrl;
          } else {
            canvas.toBlob((composited) => resolve(composited || blob), 'image/jpeg', 0.95);
          }
        };

        if (prop) {
          const propImg = new Image();
          const svgData = encodeURIComponent(prop.svg);
          propImg.onload = () => {
            const targetWidth = canvas.width * 0.42 * prop.defaultScale;
            const targetHeight = targetWidth * 0.55;
            const x = (canvas.width * prop.defaultX / 100) - (targetWidth / 2);
            const y = (canvas.height * prop.defaultY / 100) - (targetHeight / 2);
            ctx.drawImage(propImg, x, y, targetWidth, targetHeight);
            applyFrame();
          };
          propImg.onerror = () => applyFrame();
          propImg.src = `data:image/svg+xml;utf8,${svgData}`;
        } else {
          applyFrame();
        }
      };
      photo.onerror = () => resolve(blob);
      photo.src = URL.createObjectURL(blob);
    });
  }, [event?.branding?.frameUrl, activePropId]);

  const processCaptures = useCallback(
    async (frames: Blob[]) => {
      setPhase('processing');
      setProcessing(true);

      try {
        if (!event) throw new Error('No event loaded');

        const composited = await Promise.all(frames.map((f) => compositeWithFrame(f)));

        const clientPhotoId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const localPreviewUrl = URL.createObjectURL(composited[0]);
        const format: 'single' | 'strip' | 'gif' =
          mode === 'strip' ? 'strip' : mode === 'gif' || mode === 'boomerang' ? 'gif' : 'single';

        const offlineRecord: OfflinePhotoRecord = {
          clientPhotoId,
          eventId: event.id,
          sessionId: sessionId || '',
          blob: composited[0],
          format,
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending',
          localPreviewUrl,
        };

        try {
          await queueOfflinePhoto(offlineRecord);
        } catch (dbErr) {
          console.warn('[CountdownScreen] IndexedDB pre-save warning:', dbErr);
        }

        try {
          let result;

          if (mode === 'single' || mode === 'aistudio') {
            result = await uploadPhoto(composited[0], event.id, sessionId, 'single', clientPhotoId);
            await removeQueuedPhoto(clientPhotoId);
            setCurrentPhoto(result.photo);
            setScreen(mode === 'aistudio' ? 'aistudio' : 'preview');
          } else if (mode === 'strip') {
            result = await createStrip(composited, event.id, clientPhotoId, sessionId);
            await removeQueuedPhoto(clientPhotoId);
            setCurrentPhoto({ ...result.strip, mode: 'strip' });
            setScreen('preview');
          } else if (mode === 'gif' || mode === 'boomerang') {
            result = await createGIF(composited, event.id, mode, clientPhotoId, sessionId);
            await removeQueuedPhoto(clientPhotoId);
            setCurrentPhoto({ ...result.gif, mode });
            setScreen('preview');
          }
        } catch (uploadError: any) {
          console.warn('[CountdownScreen] Network upload failed, using local offline queue preview:', uploadError);

          toast.success('Saved to offline storage! Ready to view.', {
            icon: '💾',
            duration: 4000,
          });

          setCurrentPhoto({
            id: clientPhotoId,
            url: localPreviewUrl,
            thumbUrl: localPreviewUrl,
            thumb_url: localPreviewUrl,
            downloadUrl: localPreviewUrl,
            galleryUrl: '',
            gallery_url: '',
            qrCode: '',
            whatsappUrl: '',
            mode: (mode === 'aistudio' ? 'single' : mode) as any,
            isOfflinePending: true,
          } as any);

          setScreen(mode === 'aistudio' ? 'aistudio' : 'preview');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Capture failed: ${msg}`);
        setScreen('idle');
      } finally {
        setProcessing(false);
        clearFrames();
      }
    },
    [event, mode, sessionId, setCurrentPhoto, setScreen, setProcessing, clearFrames, compositeWithFrame]
  );

  // Main countdown + capture loop
  useEffect(() => {
    if (!isCameraReady) return;

    let cancelled = false;

    async function runSession() {
      const allFrames: Blob[] = [];

      for (let shot = 0; shot < totalShots; shot++) {
        if (cancelled) return;

        if (roamingMode) {
          setPhase('capturing');
          setCountdown(null);
          triggerFlash();
          if (soundEnabled) playShutter();
          await sleep(150);
        } else {
          setPhase('countdown');
          for (let i = countdownSeconds; i >= 1; i--) {
            if (cancelled) return;
            setCountdown(i);
            if (soundEnabled) playBeep(i === 1 ? 1200 : 880, 0.14, 0.35);
            await sleep(1000);
          }
          setCountdown(null);
          setPhase('capturing');
          triggerFlash();
          if (soundEnabled) playShutter();
          await sleep(120);
        }

        const frame = captureFrame();
        if (frame) allFrames.push(frame);
        setShotsTaken(shot + 1);

        if (shot < totalShots - 1) {
          await sleep(850);
        }
      }

      if (!cancelled) {
        await processCaptures(allFrames);
      }
    }

    const t = setTimeout(runSession, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraReady]);

  const modeBadge: Record<string, { label: string; icon: string }> = {
    single: { label: 'Single Shot', icon: '📸' },
    strip: { label: `Photo Strip (${shotsTaken}/${STRIP_COUNT})`, icon: '🎞️' },
    gif: { label: `GIF Burst (${shotsTaken}/${GIF_COUNT})`, icon: '🎬' },
    boomerang: { label: `Boomerang (${shotsTaken}/${BOOMERANG_COUNT})`, icon: '🔄' },
    burst: { label: `Burst (${shotsTaken}/${GIF_COUNT})`, icon: '⚡' },
    aistudio: { label: 'AI Studio Portrait', icon: '✨' },
  };
  const activeBadge = modeBadge[mode] || { label: 'Photo', icon: '📸' };

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative select-none overflow-hidden">
      {/* Viewfinder Main Stage */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.96}
          videoConstraints={{
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          className="w-full h-full object-cover transition-all duration-300"
          style={{ filter: glamFilterStyle || undefined }}
          mirrored={true}
          onUserMedia={() => {
            setTimeout(() => setIsCameraReady(true), 400);
          }}
          onUserMediaError={(err) => {
            const msg = err instanceof Error ? err.message : String(err);
            setCameraError(
              msg.includes('NotAllowed') || msg.includes('Permission')
                ? 'Camera permission denied. Please allow camera access in browser settings.'
                : 'Could not access camera hardware. Verify no other application is using it.'
            );
          }}
        />

        {/* Live AR Digital Props & Stickers Overlay */}
        {enableDigitalProps && phase !== 'processing' && isCameraReady && (
          <ARPropsOverlay
            activePropId={activePropId}
            onSelectProp={setActivePropId}
          />
        )}

        {/* Framing Guides: Corner Brackets (Luxury Viewfinder Aesthetic) */}
        <div className="absolute inset-8 sm:inset-14 pointer-events-none border border-white/10 rounded-3xl">
          {/* Top-Left */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-purple-400 rounded-tl-xl shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
          {/* Top-Right */}
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-purple-400 rounded-tr-xl shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
          {/* Bottom-Left */}
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-purple-400 rounded-bl-xl shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
          {/* Bottom-Right */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-purple-400 rounded-br-xl shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

          {/* Center Crosshair Guides */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none opacity-20">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white" />
          </div>
        </div>

        {/* Top Control Bar */}
        <div className="absolute top-6 inset-x-6 flex items-center justify-between z-20">
          <button
            onClick={() => setScreen('style')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#181938]/95 border-2 border-slate-700 text-white/90 hover:text-white transition-all text-xs font-bold active:scale-95 shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel
          </button>

          {/* Mode & Glam Badges */}
          <div className="flex items-center gap-2">
            {glamMode !== 'off' && (
              <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-500/20 border-2 border-amber-500/40 text-amber-300 text-xs font-black shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>{glamMode === 'kardashian_bw' ? 'Kardashian B&W' : 'Hollywood Glow'}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#181938]/95 border-2 border-slate-700 text-white text-xs font-black shadow-lg">
              <span>{activeBadge.icon}</span>
              <span>{activeBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Shot Dots for Multi-Shot */}
        {totalShots > 1 && phase !== 'processing' && (
          <div className="absolute top-20 inset-x-0 flex justify-center gap-3 z-20">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div
                key={i}
                className={`transition-all duration-300 rounded-full ${
                  i < shotsTaken
                    ? 'w-4 h-4 bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.9)] scale-110'
                    : i === shotsTaken
                    ? 'w-4 h-4 bg-white/70 animate-pulse'
                    : 'w-3 h-3 bg-white/20'
                }`}
              />
            ))}
          </div>
        )}

        {/* Camera Warm-up Overlay */}
        <AnimatePresence>
          {!isCameraReady && !cameraError && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-[#07070d] flex flex-col items-center justify-center gap-4 z-30"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">
                  📷
                </div>
              </div>
              <p className="text-white/60 text-sm font-semibold tracking-wide">Starting Camera Engine...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 bg-[#07070d]/95 flex flex-col items-center justify-center gap-5 p-8 text-center z-40">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl">
              ⚠️
            </div>
            <div className="max-w-md">
              <h3 className="text-white font-bold text-lg mb-2">Camera Unavailable</h3>
              <p className="text-white/60 text-sm mb-6">{cameraError}</p>
            </div>
            <button
              onClick={() => setScreen('idle')}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all"
            >
              Return to Start
            </button>
          </div>
        )}

        {/* High-Impact Animated Radial Countdown */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              key={countdown}
              initial={shouldReduceMotion ? { opacity: 0 } : { scale: 1.45, opacity: 0, filter: 'blur(8px)' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.15 }
                  : { type: 'spring', stiffness: 380, damping: 24, mass: 0.8 }
              }
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <div className="relative flex items-center justify-center">
                {/* SVG Countdown Ring */}
                <svg className="w-56 h-56 sm:w-64 sm:h-64 -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="90"
                    className="stroke-white/10"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="90"
                    className="stroke-purple-500 transition-all duration-1000 ease-linear shadow-[0_0_20px_rgba(168,85,247,0.8)]"
                    strokeWidth="8"
                    strokeDasharray="565"
                    strokeDashoffset={565 - (565 * (countdown / countdownSeconds))}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Inner Number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-[#181938]/95 border-4 border-white/30 flex items-center justify-center shadow-2xl">
                    <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter drop-shadow-[0_4px_24px_rgba(168,85,247,0.7)]">
                      {countdown}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shutter Click Indicator */}
        {phase === 'capturing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className="w-36 h-36 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border-4 border-white shadow-2xl">
              <Camera className="w-16 h-16 text-white" />
            </div>
          </motion.div>
        )}

        {/* Processing Spinner Stage */}
        {phase === 'processing' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-40">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-purple-400 animate-pulse" />
              </div>
            </div>
            <h3 className="text-white text-2xl font-black mb-2 tracking-tight">
              {mode === 'gif' || mode === 'boomerang'
                ? 'Rendering High-FPS Animation...'
                : mode === 'strip'
                ? 'Assembling 4-Pose Print Strip...'
                : mode === 'aistudio'
                ? 'Generating AI Transformations...'
                : 'Developing Photo...'}
            </h3>
            <p className="text-white/50 text-sm font-medium">Applying high-fidelity color grading</p>
          </div>
        )}
      </div>

      {/* Dynamic Status Bottom Bar */}
      <div className="h-20 glass-crystal border-t border-black/5 dark:border-white/10 px-8 flex items-center justify-between z-20">
        <div className="w-24">
          <p className="text-slate-500 dark:text-white/40 text-xs font-bold uppercase tracking-wider">
            {event?.branding?.eventName || 'SnapBooth'}
          </p>
        </div>

        <div className="text-center">
          {phase === 'ready' && (
            <p className="text-slate-700 dark:text-white/80 font-black text-sm tracking-wide animate-pulse">Get ready in position...</p>
          )}
          {phase === 'countdown' && (
            <p className="text-purple-600 dark:text-purple-300 font-black text-base tracking-wide">Look directly at the lens! 😊</p>
          )}
          {phase === 'capturing' && (
            <p className="text-emerald-500 dark:text-emerald-400 font-black text-base tracking-wide">Captured! ✨</p>
          )}
          {phase === 'processing' && (
            <p className="text-slate-500 dark:text-white/60 font-bold text-sm">Finishing touches...</p>
          )}
        </div>

        <div className="w-24 text-right">
          <span className="text-xs font-mono text-slate-400 dark:text-white/30 font-bold">1080p • 60fps</span>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
