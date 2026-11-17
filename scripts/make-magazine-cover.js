const sharp = require('../backend/node_modules/sharp');
const fs = require('fs');
const path = require('path');

async function createMagazineCover() {
  const inputPath = 'C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/celebrity_red_carpet_portrait_1794949401427.jpg';
  const outputPath = 'C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/celebrity_magazine_tatler_cover.jpg';

  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 1600;

  // Authentic Tatler / Vogue high-DPI magazine typography
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.85"/>
        </filter>
        <filter id="subtleShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>

      <!-- Magazine Masthead: TATLER -->
      <text x="${width / 2}" y="${height * 0.13}" 
        font-family="'Times New Roman', 'Playfair Display', serif" 
        font-size="${width * 0.17}" 
        font-weight="900" 
        letter-spacing="${width * 0.04}" 
        fill="#ffffff" 
        text-anchor="middle" 
        filter="url(#shadow)">
        TATLER
      </text>

      <!-- Masthead Tagline -->
      <text x="${width / 2}" y="${height * 0.165}" 
        font-family="'Helvetica Neue', Arial, sans-serif" 
        font-size="${width * 0.022}" 
        font-weight="800" 
        letter-spacing="${width * 0.012}" 
        fill="#ffffff" 
        text-anchor="middle" 
        filter="url(#subtleShadow)">
        WHERE CELEBRITY MEETS ENTERPRISE
      </text>

      <!-- Main Headline: THE NEW ICONS OF SUCCESS -->
      <g filter="url(#shadow)">
        <text x="${width * 0.07}" y="${height * 0.72}" 
          font-family="'Times New Roman', 'Playfair Display', serif" 
          font-size="${width * 0.065}" 
          font-weight="900" 
          letter-spacing="2" 
          fill="#ffffff">
          THE NEW
        </text>
        <text x="${width * 0.07}" y="${height * 0.78}" 
          font-family="'Times New Roman', 'Playfair Display', serif" 
          font-size="${width * 0.065}" 
          font-weight="900" 
          letter-spacing="2" 
          fill="#ffffff">
          ICONS OF
        </text>
        <text x="${width * 0.07}" y="${height * 0.84}" 
          font-family="'Times New Roman', 'Playfair Display', serif" 
          font-size="${width * 0.065}" 
          font-weight="900" 
          letter-spacing="2" 
          fill="#ffffff">
          SUCCESS
        </text>
      </g>

      <!-- Sub-headline Deck -->
      <g filter="url(#subtleShadow)">
        <text x="${width * 0.07}" y="${height * 0.88}" 
          font-family="'Helvetica Neue', Arial, sans-serif" 
          font-size="${width * 0.024}" 
          font-weight="700" 
          letter-spacing="1" 
          fill="#e2e8f0">
          HOW CELEBRITY ENTREPRENEURS
        </text>
        <text x="${width * 0.07}" y="${height * 0.908}" 
          font-family="'Helvetica Neue', Arial, sans-serif" 
          font-size="${width * 0.024}" 
          font-weight="700" 
          letter-spacing="1" 
          fill="#e2e8f0">
          ARE REDEFINING LUXURY,
        </text>
        <text x="${width * 0.07}" y="${height * 0.936}" 
          font-family="'Helvetica Neue', Arial, sans-serif" 
          font-size="${width * 0.024}" 
          font-weight="700" 
          letter-spacing="1" 
          fill="#e2e8f0">
          INNOVATION, AND GLOBAL INFLUENCE.
        </text>
      </g>

      <!-- Bottom Barcode & Date Stamp -->
      <rect x="${width * 0.76}" y="${height * 0.91}" width="${width * 0.18}" height="${height * 0.045}" fill="#ffffff" rx="4"/>
      <g fill="#000000">
        <!-- Barcode lines -->
        <rect x="${width * 0.78}" y="${height * 0.92}" width="3" height="${height * 0.025}"/>
        <rect x="${width * 0.79}" y="${height * 0.92}" width="2" height="${height * 0.025}"/>
        <rect x="${width * 0.80}" y="${height * 0.92}" width="5" height="${height * 0.025}"/>
        <rect x="${width * 0.82}" y="${height * 0.92}" width="2" height="${height * 0.025}"/>
        <rect x="${width * 0.835}" y="${height * 0.92}" width="4" height="${height * 0.025}"/>
        <rect x="${width * 0.855}" y="${height * 0.92}" width="2" height="${height * 0.025}"/>
        <rect x="${width * 0.87}" y="${height * 0.92}" width="6" height="${height * 0.025}"/>
        <rect x="${width * 0.895}" y="${height * 0.92}" width="3" height="${height * 0.025}"/>
        <rect x="${width * 0.915}" y="${height * 0.92}" width="2" height="${height * 0.025}"/>
      </g>
    </svg>
  `);

  await sharp(inputPath)
    .composite([{ input: svgOverlay, blend: 'over' }])
    .jpeg({ quality: 96 })
    .toFile(outputPath);

  console.log('Cover created at:', outputPath);
}

createMagazineCover().catch(console.error);
