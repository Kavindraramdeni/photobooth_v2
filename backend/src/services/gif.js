const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

/**
 * Create animated GIF from array of image buffers
 * @param {Buffer[]} imageBuffers - Array of photo buffers (3-6 images recommended)
 * @param {Object} options - GIF options
 * @returns {Buffer} GIF buffer
 */
async function createGIF(imageBuffers, options = {}) {
  const {
    fps = 4,
    width = 800,
    loop = 0, // 0 = infinite loop
    quality = 85,
  } = options;

  const tmpDir = path.join(os.tmpdir(), `photobooth_gif_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Save each frame as a temp file
    const framePaths = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const framePath = path.join(tmpDir, `frame_${String(i).padStart(3, '0')}.jpg`);
      await sharp(imageBuffers[i])
        .resize(width, null, { fit: 'inside' })
        .jpeg({ quality })
        .toFile(framePath);
      framePaths.push(framePath);
    }

    const outputPath = path.join(tmpDir, 'output.gif');

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tmpDir, 'frame_%03d.jpg'))
        .inputOptions([`-framerate ${fps}`])
        .outputOptions([
          '-vf',
          `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer`,
          `-loop ${loop}`,
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const gifBuffer = fs.readFileSync(outputPath);
    return gifBuffer;
  } finally {
    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Create Boomerang effect (forward + reverse loop)
 * @param {Buffer[]} imageBuffers - Array of photo buffers
 * @returns {Buffer} Boomerang GIF buffer
 */
async function createBoomerang(imageBuffers, options = {}) {
  // Duplicate frames in reverse for boomerang effect
  const boomerangFrames = [...imageBuffers, ...[...imageBuffers].reverse()];
  return createGIF(boomerangFrames, { ...options, fps: 8 });
}

/**
 * Create video from frames (MP4 - better for sharing)
 */
async function createVideo(imageBuffers, options = {}) {
  const { fps = 3, width = 1080 } = options;
  const tmpDir = path.join(os.tmpdir(), `photobooth_vid_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    for (let i = 0; i < imageBuffers.length; i++) {
      const framePath = path.join(tmpDir, `frame_${String(i).padStart(3, '0')}.jpg`);
      // Each frame shown for ~1 second = duplicate frames
      for (let d = 0; d < fps; d++) {
        await sharp(imageBuffers[i])
          .resize(width, null, { fit: 'inside' })
          .jpeg({ quality: 90 })
          .toFile(path.join(tmpDir, `frame_${String(i * fps + d).padStart(4, '0')}.jpg`));
      }
    }

    const outputPath = path.join(tmpDir, 'output.mp4');

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tmpDir, 'frame_%04d.jpg'))
        .inputOptions([`-framerate ${fps}`])
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-crf 23', '-movflags +faststart'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { createGIF, createBoomerang, createVideo };
