/**
 * booth-sensory.ts
 * Zero-dependency utilities for haptic, audio, TTS and flash feedback.
 * All functions are safe to call server-side (they no-op if window is absent).
 *
 * Usage:
 *   import { haptic, sound, flash, speak } from '@/lib/booth-sensory';
 *   haptic('tap');
 *   sound('shutter');
 *   speak('3');
 *   flash();
 */

// ─── HAPTIC ──────────────────────────────────────────────────────────────────

type HapticPattern = 'tap' | 'countdown' | 'success' | 'error';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap:       30,
  countdown: [80, 40, 80],
  success:   [50, 30, 50, 30, 100],
  error:     [200, 100, 200],
};

export function haptic(pattern: HapticPattern = 'tap') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const p = HAPTIC_PATTERNS[pattern];
  navigator.vibrate(p);
}

// ─── SOUND (Web Audio API — no files needed) ─────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

/** Resume AudioContext after user gesture (call once on first tap) */
export function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainValue = 0.3,
  startOffset = 0,
) {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
  gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + startOffset + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration + 0.05);
}

type SoundEffect = 'beep' | 'shutter' | 'success' | 'error';

export function sound(effect: SoundEffect) {
  try {
    switch (effect) {
      case 'beep':
        // Short high beep — used for countdown ticks
        playTone(880, 0.12, 'sine', 0.25);
        break;

      case 'shutter':
        // Mechanical camera click: quick mid thud + high tick
        playTone(180, 0.08, 'square', 0.4);
        playTone(1200, 0.06, 'sine', 0.15, 0.04);
        break;

      case 'success':
        // Rising arpeggio — photo uploaded
        playTone(523, 0.15, 'sine', 0.25, 0.00);  // C5
        playTone(659, 0.15, 'sine', 0.25, 0.12);  // E5
        playTone(784, 0.20, 'sine', 0.30, 0.24);  // G5
        playTone(1047, 0.30, 'sine', 0.25, 0.36); // C6
        break;

      case 'error':
        // Low descending tone
        playTone(300, 0.15, 'sawtooth', 0.2, 0.00);
        playTone(200, 0.25, 'sawtooth', 0.2, 0.15);
        break;
    }
  } catch { /* audio blocked — safe to ignore */ }
}

// ─── TEXT-TO-SPEECH ──────────────────────────────────────────────────────────

let ttsEnabled = true; // set to false if speechSynthesis is broken on device

export function speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !ttsEnabled) return;
  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = options?.rate   ?? 0.9;
    utt.pitch  = options?.pitch  ?? 1.1;
    utt.volume = options?.volume ?? 1.0;
    // Prefer a female English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
    ) || voices.find(v => v.lang.startsWith('en')) || null;
    if (preferred) utt.voice = preferred;
    utt.onerror = () => { ttsEnabled = false; };
    window.speechSynthesis.speak(utt);
  } catch { ttsEnabled = false; }
}

// ─── CAMERA FLASH ────────────────────────────────────────────────────────────

let flashEl: HTMLDivElement | null = null;

function getFlashEl(): HTMLDivElement {
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'background:white', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.05s ease-in',
    ].join(';');
    document.body.appendChild(flashEl);
  }
  return flashEl;
}

/**
 * Trigger a white camera-flash overlay.
 * @param durationMs total visible time before fade-out (default 180ms)
 */
export function flash(durationMs = 180) {
  if (typeof document === 'undefined') return;
  const el = getFlashEl();
  // Flash in
  el.style.transition = 'opacity 0.04s ease-in';
  el.style.opacity = '1';
  // Flash out
  setTimeout(() => {
    el.style.transition = `opacity ${durationMs}ms ease-out`;
    el.style.opacity = '0';
  }, 60);
}

// ─── CONVENIENCE: full countdown sequence ────────────────────────────────────

/**
 * Run a countdown: beep + haptic + TTS for each number, then flash + shutter on 0.
 * @param from  starting number (default 3)
 * @param onTick  called each tick with the current number
 * @param onCapture  called when countdown reaches 0 (after flash)
 */
export function runCountdownSensory(
  from: number,
  onTick: (n: number) => void,
  onCapture: () => void,
) {
  let remaining = from;

  function tick() {
    if (remaining > 0) {
      onTick(remaining);
      sound('beep');
      haptic('countdown');
      speak(String(remaining));
      remaining--;
      setTimeout(tick, 1000);
    } else {
      // Capture moment
      sound('shutter');
      haptic('success');
      speak('Smile!', { rate: 1.1, pitch: 1.3 });
      flash();
      onCapture();
    }
  }

  tick();
}
