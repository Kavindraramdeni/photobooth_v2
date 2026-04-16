'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { uploadPhoto, createGIF, createStrip } from '@/lib/api';
import toast from 'react-hot-toast';


// ── Web Audio API sounds (no files needed) ───────────────────────────────────
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
    // Click sound: short noise burst
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
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
    addFrame, clearFrames, capturedFrames,
    setProcessing, triggerFlash,
  } = useBoothStore();

  const webcamRef = useRef<Webcam>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'capturing' | 'processing'>('ready');
  const [shotsTaken, setShotsTaken] = useState(0);
  // ── Camera warm-up: block countdown until the camera stream is live ──────
  // On iPad Safari the Webcam component mounts before the video pipeline is
  // ready. getScreenshot() during that window returns null or a black frame.
  // We wait for onUserMedia, then add an extra 400ms so the sensor can
  // auto-expose — this eliminates the 1-2s black screen on first capture.
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const totalShots = mode === 'strip' ? STRIP_COUNT : mode === 'gif' ? GIF_COUNT : mode === 'boomerang' ? BOOMERANG_COUNT : 1;
  const countdownSeconds = event?.settings?.countdownSeconds ?? 3;
  const soundEnabled = (event?.settings?.countdownSound as boolean) !== false; // on by default
  const roamingMode = (event?.settings?.roamingMode as boolean) ?? false; // no countdown, instant capture

  const captureFrame = useCallback((): Blob | null => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return null;

    // Convert base64 to blob
    const arr = imageSrc.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  }, []);

  // Composite captured frame with the event frame overlay (if set)
  const compositeWithFrame = useCallback(async (blob: Blob): Promise<Blob> => {
    const frameUrl = event?.branding?.frameUrl as string | null | undefined;
    if (!frameUrl) return blob; // no overlay configured — return as-is

    return new Promise((resolve) => {
      const photo = new Image();
      const frame = new Image();
      frame.crossOrigin = 'anonymous';
      photo.crossOrigin = 'anonymous';

      photo.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = photo.naturalWidth;
        canvas.height = photo.naturalHeight;
        const ctx = canvas.getContext('2d')!;

        // Draw webcam photo
        ctx.drawImage(photo, 0, 0);

        // Draw frame overlay on top (stretched to fill)
        frame.onload = () => {
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (composited) => resolve(composited || blob),
            'image/jpeg',
            0.92
          );
        };
        frame.onerror = () => resolve(blob); // fallback: use original
        frame.src = frameUrl;
      };
      photo.onerror = () => resolve(blob);
      photo.src = URL.createObjectURL(blob);
    });
  }, [event?.branding?.frameUrl]);

  const processCaptures = useCallback(
    async (frames: Blob[]) => {
      setPhase('processing');
      setProcessing(true);

      try {
        if (!event) throw new Error('No event loaded');

        // Apply frame overlay to every captured frame before upload
        const composited = await Promise.all(frames.map(f => compositeWithFrame(f)));

        let result;

        if (mode === 'single' || mode === 'aistudio') {
          result = await uploadPhoto(composited[0], event.id, sessionId, 'single');
          setCurrentPhoto(result.photo);
          // AI Studio goes to AIStudioScreen (style picker), regular photo goes to PreviewScreen
          setScreen(mode === 'aistudio' ? 'aistudio' : 'preview');
        } else if (mode === 'strip') {
          result = await createStrip(composited, event.id);
          setCurrentPhoto({ ...result.strip, mode: 'strip' });
          setScreen('preview');
        } else if (mode === 'gif' || mode === 'boomerang') {
          result = await createGIF(composited, event.id, mode);
          setCurrentPhoto({ ...result.gif, mode });
          setScreen('preview');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to process: ${msg}`);
        setScreen('idle');
      } finally {
        setProcessing(false);
        clearFrames();
      }
    },
    [event, mode, sessionId, setCurrentPhoto, setScreen, setProcessing, clearFrames, compositeWithFrame]
  );

  // Main countdown + capture logic — only fires once isCameraReady is true
  useEffect(() => {
    if (!isCameraReady) return; // wait for onUserMedia + warm-up delay

    let cancelled = false;

    async function runSession() {
      const allFrames: Blob[] = [];

      for (let shot = 0; shot < totalShots; shot++) {
        if (cancelled) return;

        if (roamingMode) {
          // Roaming mode: no countdown, capture immediately
          setPhase('capturing');
          setCountdown(null);
          triggerFlash();
          if (soundEnabled) playShutter();
          await sleep(150);
        } else {
          // Normal countdown
          setPhase('countdown');
          for (let i = countdownSeconds; i >= 1; i--) {
            if (cancelled) return;
            setCountdown(i);
            if (soundEnabled) playBeep(i === 1 ? 1100 : 880, 0.15, 0.35);
            await sleep(1000);
          }
          setCountdown(null);
          setPhase('capturing');
          triggerFlash();
          if (soundEnabled) playShutter();
          await sleep(100);
        }

        const frame = captureFrame();
        if (frame) allFrames.push(frame);
        setShotsTaken(shot + 1);

        if (shot < totalShots - 1) {
          await sleep(800); // brief pause between shots
        }
      }

      if (!cancelled) {
        await processCaptures(allFrames);
      }
    }

    // Brief extra delay so auto-exposure settles after camera ready signal
    const t = setTimeout(runSession, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraReady]);

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {/* Webcam - fills most of screen */}
      <div className="flex-1 relative overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          videoConstraints={{
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          className="w-full h-full object-cover"
          mirrored={true}
          onUserMedia={() => {
            // Camera stream is live — wait 400ms for auto-exposure to settle
            // before marking ready and starting the countdown. This eliminates
            // the black/under-exposed first frame on iPad Safari.
            setTimeout(() => setIsCameraReady(true), 400);
          }}
          onUserMediaError={(err) => {
            const msg = err instanceof Error ? err.message : String(err);
            setCameraError(
              msg.includes('NotAllowed') || msg.includes('Permission')
                ? 'Camera permission denied. Please allow camera access and try again.'
                : 'Could not start camera. Check it isn\'t in use by another app.'
            );
          }}
        />

        {/* Camera warm-up overlay — shown until stream is ready */}
        <AnimatePresence>
          {!isCameraReady && !cameraError && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-5xl"
              >
                📷
              </motion.div>
              <p className="text-white/50 text-sm">Starting camera…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera error overlay */}
        {cameraError && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-5xl">🚫</div>
            <p className="text-white font-semibold text-base">{cameraError}</p>
            <button
              onClick={() => setScreen('idle')}
              className="px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Processing overlay */}
        {phase === 'processing' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white text-xl font-semibold">
              {mode === 'gif' || mode === 'boomerang' ? 'Creating your GIF...' : 'Processing photo...'}
            </p>
          </div>
        )}

        {/* Shot progress for multi-shot modes */}
        {totalShots > 1 && phase !== 'processing' && (
          <div className="absolute top-6 left-0 right-0 flex justify-center gap-3">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < shotsTaken ? 'bg-purple-400 scale-125' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}

        {/* Mode label */}
        <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-3 py-1.5">
          <span className="text-white/80 text-sm font-medium uppercase tracking-wider">
            {mode === 'boomerang' ? '🔄 Boomerang' : mode === 'gif' ? '🎬 GIF' : mode === 'strip' ? '🎞️ Strip' : '📸 Photo'}
          </span>
        </div>
      </div>

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-48 h-48 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border-4 border-purple-500 glow-purple">
              <span className="text-8xl font-black text-white">{countdown}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture flash indicator */}
      {phase === 'capturing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-6xl">📸</span>
          </div>
        </motion.div>
      )}

      {/* Bottom status bar */}
      <div className="bg-black px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setScreen('idle')}
          className="text-white/50 text-sm px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 transition-colors"
        >
          Cancel
        </button>
        <div className="text-center">
          {phase === 'ready' && <p className="text-white/60">Get ready...</p>}
          {phase === 'countdown' && <p className="text-white font-semibold">Smile! 😊</p>}
          {phase === 'capturing' && <p className="text-purple-400 font-bold">Click! ✨</p>}
          {phase === 'processing' && <p className="text-white/60">Almost done...</p>}
        </div>
        <div className="w-20" />
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
