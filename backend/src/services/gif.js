/**
 * backend/src/services/gif.js
 *
 * Pure-JS GIF creation — no ffmpeg dependency, works on Render free tier.
 * Uses the `gif-encoder-2` library (MIT, pure JS, no native binaries).
 *
 * Also exports createBoomerang and createVideo (MP4 via ffmpeg if available,
 * falls back to GIF with boomerang frames).
 */

let GifEncoder;
try {
  GifEncoder = require('gif-encoder-2');
} catch (e) {
  console.warn('[gif] gif-encoder-2 not available:', e.message);
}

let sharp;
try { sharp = require('sharp'); } catch (e) { console.error('[gif] sharp load failed:', e.message); }

let ffmpeg = null;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch {
  console.warn('[gif] fluent-ffmpeg not available — video export disabled, using GIF fallback');
}

const { createCanvas, loadImage } = (() => {
  try { return require('canvas'); }
  catch { return { createCanvas: null, loadImage: null }; }
})();

/**
 * Create animated GIF from array of image Buffers.
 * Uses gif-encoder-2 (pure JS) — no ffmpeg needed.
 */
async function createGIF(imageBuffers, options = {}) {
  if (!GifEncoder) throw new Error('gif-encoder-2 not installed. Run: npm install gif-encoder-2');
  if (!sharp)     throw new Error('sharp not available');

  const {
    fps    = 6,
    width  = 600,
    delay  = null, // ms per frame; if null derived from fps
  } = options;

  const frameDelay = delay || Math.round(1000 / fps);

  // Resize all frames to uniform dimensions using sharp
  const frames = await Promise.all(
    imageBuffers.map(buf =>
      sharp(buf)
        .resize(width, null, { fit: 'inside', withoutEnlargement: true })
        .png() // GIF encoder needs raw RGB, easiest via PNG intermediate then canvas
        .toBuffer()
    )
  );

  // We need pixel data — use canvas if available, otherwise sharp's raw output
  if (createCanvas && loadImage) {
    return createGIFViaCanvas(frames, width, frameDelay);
  } else {
    return createGIFViaSharpRaw(frames, frameDelay);
  }
}

/** Canvas-based path (best quality) */
async function createGIFViaCanvas(pngFrames, width, frameDelay) {
  // Load first frame to get actual dimensions
  const firstImg = await loadImage(pngFrames[0]);
  const w = firstImg.width;
  const h = firstImg.height;

  const encoder = new GifEncoder(w, h, 'neuquant', true);
  encoder.setDelay(frameDelay);
  encoder.setRepeat(0); // infinite loop
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  for (const pngBuf of pngFrames) {
    const img = await loadImage(pngBuf);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return Buffer.from(encoder.out.getData());
}

/** Sharp raw-pixel path (fallback when canvas not available) */
async function createGIFViaSharpRaw(pngFrames, frameDelay) {
  // Get dimensions from first frame
  const { width: w, height: h } = await sharp(pngFrames[0]).metadata();

  const encoder = new GifEncoder(w, h);
  encoder.setDelay(frameDelay);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  for (const pngBuf of pngFrames) {
    // Convert to raw RGBA pixel array
    const rawBuf = await sharp(pngBuf)
      .resize(w, h, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();

    // gif-encoder-2 expects a flat Uint8Array of RGBA values
    encoder.addFrame(new Uint8ClampedArray(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength));
  }

  encoder.finish();
  return Buffer.from(encoder.out.getData());
}

/**
 * Boomerang: forward frames + reversed frames = ping-pong loop
 */
async function createBoomerang(imageBuffers, options = {}) {
  // forward + reverse (skip first+last duplicate frame)
  const forward = [...imageBuffers];
  const reverse = [...imageBuffers].reverse().slice(1, -1);
  const boomerangFrames = [...forward, ...reverse];
  return createGIF(boomerangFrames, { fps: 10, ...options });
}

/**
 * Create MP4 video (ffmpeg path).
 * Falls back to GIF if ffmpeg not available.
 */
async function createVideo(imageBuffers, options = {}) {
  if (!ffmpeg) {
    // Graceful fallback: just return a GIF
    console.warn('[gif] ffmpeg not available, returning GIF instead of MP4');
    return createGIF(imageBuffers, options);
  }

  const { fps = 3, width = 1080 } = options;
  const os   = require('os');
  const path = require('path');
  const fs   = require('fs');
  const { v4: uuidv4 } = require('uuid');

  const tmpDir = path.join(os.tmpdir(), `photobooth_vid_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    for (let i = 0; i < imageBuffers.length; i++) {
      const framePath = path.join(tmpDir, `frame_${String(i).padStart(3, '0')}.jpg`);
      await sharp(imageBuffers[i])
        .resize(width, null, { fit: 'inside' })
        .jpeg({ quality: 90 })
        .toFile(framePath);
    }

    const outputPath = path.join(tmpDir, 'output.mp4');

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tmpDir, 'frame_%03d.jpg'))
        .inputOptions(['-framerate', String(fps)])
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-crf 23', '-movflags +faststart', '-vf', 'fps=30'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    return fs.readFileSync(outputPath);
  } finally {
    const fs2 = require('fs');
    fs2.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Create a slow-motion burst GIF (10 frames, smooth playback)
 * Captures 10 frames quickly and plays back at a slower fps for dreamy effect.
 */
async function createSlowMotionGIF(imageBuffers, options = {}) {
  return createGIF(imageBuffers, { fps: 4, width: 600, ...options });
}

module.exports = { createGIF, createBoomerang, createVideo, createSlowMotionGIF };
