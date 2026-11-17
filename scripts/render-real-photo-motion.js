const sharp = require('../backend/node_modules/sharp');
const fs = require('fs');

async function renderRealPhotoMotions() {
  const rawPath = 'C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/.user_uploaded/media_1794950795992_79e41056.jpg';
  const outDir = 'C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec';

  const W = 400;
  const H = 534;
  const numFrames = 22;
  const frameDelay = 75; // ~13.3 fps smooth looping GIF

  console.log('1. Loading base real photo...');
  const baseImg = await sharp(rawPath)
    .resize(W, H, { fit: 'cover' })
    .toBuffer();

  // -------------------------------------------------------------
  // ANIMATION 1: GLAM MOTION (Glambot Push-In + Paparazzi Flashes)
  // -------------------------------------------------------------
  console.log('2. Rendering Glam Motion frames on real photo...');
  const glamFrames = [];
  const delays = [];

  for (let i = 0; i < numFrames; i++) {
    const progress = i / numFrames;
    // Ease-in-out zoom: 1.0 to 1.25x
    const zoom = 1.0 + Math.sin(progress * Math.PI) * 0.22;
    const cropW = Math.round(W / zoom);
    const cropH = Math.round(H / zoom);
    const left = Math.round((W - cropW) / 2);
    const top = Math.round((H - cropH) / 2 * 0.5);

    // Flash bursts at frames 3, 10, 16
    let flashSvg = null;
    const flashFrames = [3, 10, 16];
    for (const ff of flashFrames) {
      const dist = i - ff;
      if (dist >= 0 && dist <= 2) {
        const alpha = Math.max(0, 0.82 - dist * 0.35);
        const fx = ff === 3 ? 100 : (ff === 10 ? 300 : 200);
        const fy = ff === 3 ? 140 : (ff === 10 ? 200 : 110);
        flashSvg = Buffer.from(`
          <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="flashGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="${alpha}"/>
                <stop offset="35%" stop-color="#e0f2fe" stop-opacity="${alpha * 0.6}"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="${fx}" cy="${fy}" r="280" fill="url(#flashGrad)"/>
            <rect x="0" y="${fy - 2}" width="${W}" height="4" fill="#38bdf8" opacity="${alpha * 0.4}"/>
          </svg>
        `);
        break;
      }
    }

    const composites = [];
    if (flashSvg) {
      composites.push({ input: flashSvg, top: 0, left: 0 });
    }

    // Vignette
    const vigSvg = Buffer.from(`
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vig" cx="50%" cy="50%" r="50%">
            <stop offset="40%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
          </radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#vig)"/>
      </svg>
    `);
    composites.push({ input: vigSvg, top: 0, left: 0 });

    const renderedFrame = await sharp(baseImg)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(W, H)
      .composite(composites)
      .raw()
      .toBuffer();

    glamFrames.push(renderedFrame);
    delays.push(frameDelay);
  }

  console.log('3. Encoding Glam Motion GIF...');
  const fullGlamRaw = Buffer.concat(glamFrames);
  const glamGif = await sharp(fullGlamRaw, {
    raw: { width: W, height: H * numFrames, channels: 3 }
  })
    .gif({ pageHeight: H, loop: 0, delay: delays })
    .toBuffer();

  fs.writeFileSync(`${outDir}/real_photo_glam_motion.gif`, glamGif);
  console.log('✅ Created real_photo_glam_motion.gif:', glamGif.length, 'bytes');

  // -------------------------------------------------------------
  // ANIMATION 2: AI BULLET TIME (360° Matrix Freeze + Parallax Particles)
  // -------------------------------------------------------------
  console.log('4. Rendering AI Bullet Time on real photo...');
  const bulletFrames = [];

  for (let i = 0; i < numFrames; i++) {
    const progress = i / numFrames;
    const sweep = Math.sin(progress * Math.PI * 2);
    const panOffset = Math.round(sweep * 16);

    const zoom = 1.08;
    const cropW = Math.round(W / zoom);
    const cropH = Math.round(H / zoom);
    const baseLeft = Math.round((W - cropW) / 2);
    const top = Math.round((H - cropH) / 2);
    const left = Math.max(0, Math.min(W - cropW, baseLeft + panOffset));

    const sweepX = Math.round((sweep + 1) * 0.5 * W);
    const lightSvg = Buffer.from(`
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lightBar" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
            <stop offset="50%" stop-color="#fef08a" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect x="${sweepX - 50}" y="0" width="100" height="${H}" fill="url(#lightBar)"/>
        <!-- 3D Parallax Suspended Gold Particles -->
        <circle cx="${(80 + sweep * 30 + W) % W}" cy="160" r="3.5" fill="#facc15" opacity="0.8"/>
        <circle cx="${(240 + sweep * 45 + W) % W}" cy="100" r="5" fill="#fef08a" opacity="0.9"/>
        <circle cx="${(60 + sweep * 20 + W) % W}" cy="300" r="2.5" fill="#eab308" opacity="0.7"/>
        <circle cx="${(320 + sweep * 40 + W) % W}" cy="380" r="4.5" fill="#fde047" opacity="0.85"/>
        <circle cx="${(180 + sweep * 55 + W) % W}" cy="460" r="6" fill="#facc15" opacity="0.75"/>
        <circle cx="${(350 + sweep * 15 + W) % W}" cy="220" r="2.5" fill="#ca8a04" opacity="0.6"/>
      </svg>
    `);

    const renderedFrame = await sharp(baseImg)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(W, H)
      .composite([{ input: lightSvg, top: 0, left: 0 }])
      .raw()
      .toBuffer();

    bulletFrames.push(renderedFrame);
  }

  console.log('5. Encoding Bullet Time GIF...');
  const fullBulletRaw = Buffer.concat(bulletFrames);
  const bulletGif = await sharp(fullBulletRaw, {
    raw: { width: W, height: H * numFrames, channels: 3 }
  })
    .gif({ pageHeight: H, loop: 0, delay: delays })
    .toBuffer();

  fs.writeFileSync(`${outDir}/real_photo_bullet_time.gif`, bulletGif);
  console.log('✅ Created real_photo_bullet_time.gif:', bulletGif.length, 'bytes');
}

renderRealPhotoMotions().catch(console.error);
