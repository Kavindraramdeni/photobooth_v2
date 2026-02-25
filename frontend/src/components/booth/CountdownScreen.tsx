'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoothStore } from '@/lib/store';
import { uploadPhoto, createGIF, createStrip } from '@/lib/api';
import toast from 'react-hot-toast';

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
  const totalShots = mode === 'strip' ? STRIP_COUNT : mode === 'gif' ? GIF_COUNT : mode === 'boomerang' ? BOOMERANG_COUNT : 1;
  const countdownSeconds = event?.settings?.countdownSeconds ?? 3;

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

  const processCaptures = useCallback(
    async (frames: Blob[]) => {
      setPhase('processing');
      setProcessing(true);

      try {
        if (!event) throw new Error('No event loaded');

        let result;

        if (mode === 'single') {
          result = await uploadPhoto(frames[0], event.id, sessionId, 'single');
          setCurrentPhoto(result.photo);
          setScreen('preview');
        } else if (mode === 'strip') {
          result = await createStrip(frames, event.id);
          setCurrentPhoto({ ...result.strip, mode: 'strip' });
          setScreen('preview');
        } else if (mode === 'gif' || mode === 'boomerang') {
          result = await createGIF(frames, event.id, mode);
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
    [event, mode, sessionId, setCurrentPhoto, setScreen, setProcessing, clearFrames]
  );

  // Main countdown + capture logic
  useEffect(() => {
    let cancelled = false;

    async function runSession() {
      const allFrames: Blob[] = [];

      for (let shot = 0; shot < totalShots; shot++) {
        if (cancelled) return;

        // Countdown
        setPhase('countdown');
        for (let i = countdownSeconds; i >= 1; i--) {
          if (cancelled) return;
          setCountdown(i);
          await sleep(1000);
        }

        // Flash + capture
        setCountdown(null);
        setPhase('capturing');
        triggerFlash();
        await sleep(100); // tiny delay for flash effect

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

    // Small initial delay
    const t = setTimeout(runSession, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        />

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
