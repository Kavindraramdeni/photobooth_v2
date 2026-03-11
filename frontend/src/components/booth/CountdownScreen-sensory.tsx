'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { uploadPhoto, createGIF, createStrip, createBurst } from '@/lib/api';
import toast from 'react-hot-toast';

const STRIP_COUNT     = 4;
const GIF_COUNT       = 6;
const BOOMERANG_COUNT = 8;  // more frames = smoother boomerang
const BURST_COUNT     = 10; // slow-motion burst

export function CountdownScreen() {
  const {
    event, mode, sessionId,
    setScreen, setCurrentPhoto,
    clearFrames,
    setProcessing, triggerFlash,
  } = useBoothStore();

  const webcamRef    = useRef<Webcam>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase]         = useState<'ready' | 'countdown' | 'capturing' | 'processing'>('ready');
  const [shotsTaken, setShotsTaken]   = useState(0);
  const [capturedPreviews, setCapturedPreviews] = useState<string[]>([]); // base64 for strip preview
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError]     = useState('');

  const isBurst = mode === 'burst';
  const totalShots = mode === 'strip'     ? STRIP_COUNT
                   : mode === 'gif'       ? GIF_COUNT
                   : mode === 'boomerang' ? BOOMERANG_COUNT
                   : isBurst             ? BURST_COUNT
                   : 1;

  const countdownSeconds = event?.settings?.countdownSeconds ?? 3;
  const isMultiShot = totalShots > 1;

  const captureFrame = useCallback((): { blob: Blob; src: string } | null => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return null;
    const arr  = imageSrc.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return { blob: new Blob([u8arr], { type: mime }), src: imageSrc };
  }, []);

  const processCaptures = useCallback(
    async (frames: Blob[], previews: string[]) => {
      setPhase('processing');
      setProcessing(true);

      try {
        if (!event) throw new Error('No event loaded');
        let result;

        if (mode === 'single') {
          result = await uploadPhoto(frames[0], event.id, sessionId, 'single');
          setCurrentPhoto({ ...result.photo, mode: 'single', capturedFrames: previews });
          setScreen('preview');

        } else if (mode === 'strip') {
          result = await createStrip(frames, event.id);
          setCurrentPhoto({ ...result.strip, mode: 'strip', capturedFrames: previews });
          setScreen('preview');

        } else if (mode === 'gif' || mode === 'boomerang') {
          result = await createGIF(frames, event.id, mode);
          setCurrentPhoto({ ...result.gif, mode, capturedFrames: previews });
          setScreen('preview');

        } else if (isBurst) {
          result = await createBurst(frames, event.id, undefined);
          setCurrentPhoto({ ...result.gif, mode: 'gif', capturedFrames: previews });
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
    [event, mode, isBurst, sessionId, setCurrentPhoto, setScreen, setProcessing, clearFrames]
  );

  useEffect(() => {
    if (!isCameraReady) return;
    let cancelled = false;

    async function runSession() {
      const allFrames: Blob[]   = [];
      const allPreviews: string[] = [];

      for (let shot = 0; shot < totalShots; shot++) {
        if (cancelled) return;

        // For burst/boomerang: only count down on first shot
        if (shot === 0 || mode === 'strip') {
          setPhase('countdown');
          for (let i = countdownSeconds; i >= 1; i--) {
            if (cancelled) return;
            setCountdown(i);
            await sleep(1000);
          }
          setCountdown(null);
        }

        // Rapid capture for GIF/boomerang/burst (no countdown between frames)
        setPhase('capturing');
        triggerFlash();
        await sleep(80);

        const captured = captureFrame();
        if (captured) {
          allFrames.push(captured.blob);
          allPreviews.push(captured.src);
          setCapturedPreviews([...allPreviews]);
        }
        setShotsTaken(shot + 1);

        if (shot < totalShots - 1) {
          // Strip: pause between each shot; GIF/burst: rapid fire
          const pause = mode === 'strip'     ? 800
                      : mode === 'gif'       ? 200
                      : mode === 'boomerang' ? 150
                      : isBurst             ? 100
                      : 0;
          await sleep(pause);
        }
      }

      if (!cancelled) {
        await processCaptures(allFrames, allPreviews);
      }
    }

    const t = setTimeout(runSession, 200);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraReady]);

  const modeLabel = mode === 'boomerang' ? '🔄 Boomerang'
                  : mode === 'gif'       ? '🎬 GIF'
                  : mode === 'strip'     ? '🎞️ Strip'
                  : isBurst             ? '💫 Slow-Mo'
                  : '📸 Photo';

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {/* Webcam */}
      <div className="flex-1 relative overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          videoConstraints={{ facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }}
          className="w-full h-full object-cover"
          mirrored={true}
          onUserMedia={() => setTimeout(() => setIsCameraReady(true), 400)}
          onUserMediaError={(err) => {
            const msg = err instanceof Error ? err.message : String(err);
            setCameraError(
              msg.includes('NotAllowed') || msg.includes('Permission')
                ? 'Camera permission denied. Please allow camera access and try again.'
                : "Could not start camera. Check it isn't in use by another app."
            );
          }}
        />

        {/* Camera warm-up overlay */}
        <AnimatePresence>
          {!isCameraReady && !cameraError && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4"
            >
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-5xl">
                📷
              </motion.div>
              <p className="text-white/50 text-sm">Starting camera…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-5xl">🚫</div>
            <p className="text-white font-semibold text-base">{cameraError}</p>
            <button onClick={() => setScreen('idle')} className="px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm">Go Back</button>
          </div>
        )}

        {/* Processing overlay */}
        {phase === 'processing' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-xl font-semibold">
              {mode === 'gif' || mode === 'boomerang' ? 'Creating your GIF…'
               : isBurst ? 'Creating slow-mo…'
               : 'Processing…'}
            </p>

            {/* Strip frame previews during processing */}
            {mode === 'strip' && capturedPreviews.length > 0 && (
              <div className="flex gap-2 mt-2">
                {capturedPreviews.map((src, i) => (
                  <img key={i} src={src} alt={`Frame ${i+1}`}
                    className="w-16 h-16 object-cover rounded-lg border-2 border-purple-500/60" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shot progress dots */}
        {isMultiShot && phase !== 'processing' && (
          <div className="absolute top-6 left-0 right-0 flex justify-center gap-2">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                i < shotsTaken ? 'bg-purple-400 scale-125' : 'bg-white/30'
              }`} />
            ))}
          </div>
        )}

        {/* Strip previews in corner during capture */}
        {mode === 'strip' && capturedPreviews.length > 0 && phase !== 'processing' && (
          <div className="absolute bottom-20 right-4 flex flex-col gap-1">
            {capturedPreviews.map((src, i) => (
              <motion.img
                key={i} src={src} alt={`Shot ${i+1}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-14 h-14 object-cover rounded-lg border-2 border-white/40 shadow-lg"
              />
            ))}
          </div>
        )}

        {/* Mode label */}
        <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-3 py-1.5">
          <span className="text-white/80 text-sm font-medium">{modeLabel}</span>
        </div>

        {/* Burst mode: rapid capture indicator */}
        {(mode === 'gif' || mode === 'boomerang' || isBurst) && phase === 'capturing' && (
          <div className="absolute top-16 left-0 right-0 flex justify-center">
            <div className="bg-purple-600/80 backdrop-blur rounded-full px-4 py-1 text-white text-sm font-bold animate-pulse">
              {mode === 'boomerang' ? '🔄 Capturing burst…' : isBurst ? '💫 Rapid capture…' : '🎬 Capturing frames…'}
            </div>
          </div>
        )}
      </div>

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-48 h-48 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border-4 border-purple-500">
              <span className="text-8xl font-black text-white">{countdown}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash indicator */}
      {phase === 'capturing' && (
        <motion.div
          initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-white pointer-events-none"
        />
      )}

      {/* Bottom status */}
      <div className="bg-black px-6 py-4 flex items-center justify-between">
        <button onClick={() => setScreen('idle')}
          className="text-white/50 text-sm px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 transition-colors">
          Cancel
        </button>
        <div className="text-center">
          {phase === 'ready'      && <p className="text-white/60">Get ready...</p>}
          {phase === 'countdown'  && <p className="text-white font-semibold">Smile! 😊</p>}
          {phase === 'capturing'  && <p className="text-purple-400 font-bold">Click! ✨</p>}
          {phase === 'processing' && <p className="text-white/60">Almost done...</p>}
        </div>
        <div className="w-20 text-right">
          {isMultiShot && phase !== 'processing' && (
            <span className="text-white/40 text-xs">{shotsTaken}/{totalShots}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
