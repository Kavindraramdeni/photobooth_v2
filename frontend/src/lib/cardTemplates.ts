/**
 * 4×6 (Portrait: 1200×1800) and 6×4 (Landscape: 1800×1200) Commemorative Card Templates
 * Designed for standard 4×6 dye-sub photobooth printers (DNP, Citizen, HiTi, Sinfonia, AirPrint).
 * 
 * Features:
 * - High-DPI 300 DPI vector rendering
 * - Authentic Indian Wedding, Royal Mandap, Birthday & Gala presets
 * - Center photo placement with soft bottom feathering (as in real wedding souvenir prints)
 * - Support for custom Canva / Photoshop transparent PNG overlays
 */

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  featherBottom?: boolean;
}

export interface CardTemplate {
  id: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  category: 'wedding' | 'celebration' | 'corporate' | 'minimal';
  badge: string;
  description: string;
  headlineDefault?: string;
  subtitleDefault?: string;
  photoSlot: PhotoSlot;
  getOverlaySvg: (opts?: { headline?: string; subtitle?: string; date?: string; names?: string }) => string;
}

// ─── 1. PORTRAIT 4×6 PRESETS (1200 × 1800 px) ────────────────────────────────

/**
 * Traditional Indian Wedding Souvenir Card (Portrait 4×6)
 * Based directly on royal Indian wedding thank-you cards:
 * - Ornate Rajasthani/Mughal jharokha archway with hanging jasmine & floral bells
 * - Center arched photo window with soft bottom blend
 * - Illustrated bride (emerald & mustard lehenga) & groom (emerald sherwani)
 * - Palace chhatri domes & lush garden foliage
 * - Flowing gold calligraphy: "Thank You for Attending Our Wedding"
 */
function getIndianWeddingPortraitSvg(opts?: { headline?: string; subtitle?: string; names?: string; date?: string }): string {
  const headline = opts?.headline || 'Thank You for Attending Our Wedding';
  const sub1 = opts?.subtitle || 'Our day was made special by your presence.';
  const sub2 = 'We are deeply grateful for your love and support.';
  const names = opts?.names || '';
  const date = opts?.date || '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" width="1200" height="1800">
    <defs>
      <!-- Cutout mask: white covers background, black cuts out the center arch window -->
      <mask id="portraitArchMask">
        <rect width="1200" height="1800" fill="white" />
        <!-- Center Arch Cutout -->
        <path d="M 120 400 
                 Q 120 180 350 140 
                 Q 600 40 850 140 
                 Q 1080 180 1080 400 
                 L 1080 1140 
                 Q 600 1160 120 1140 Z" fill="black" />
      </mask>

      <!-- Soft bottom feather gradient for seamless blending -->
      <linearGradient id="softFeather" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f8f4ec" stop-opacity="0" />
        <stop offset="65%" stop-color="#f8f4ec" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#f8f4ec" stop-opacity="1" />
      </linearGradient>

      <!-- Royal Gold Gradient -->
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#d4af37" />
        <stop offset="50%" stop-color="#f3e5ab" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>

      <!-- Royal Emerald Gradient -->
      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a3925" />
        <stop offset="100%" stop-color="#145a3c" />
      </linearGradient>

      <!-- Mustard Dupatta Gradient -->
      <linearGradient id="mustardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e89d14" />
        <stop offset="100%" stop-color="#cc8100" />
      </linearGradient>
    </defs>

    <!-- 1. Background Frame with Arch Cutout Window -->
    <rect width="1200" height="1800" fill="#f8f4ec" mask="url(#portraitArchMask)" />

    <!-- 2. Subtle Background Mandala Rings in Header & Footer -->
    <g opacity="0.18" stroke="#caa560" stroke-width="1.5" fill="none">
      <circle cx="600" cy="140" r="180" />
      <circle cx="600" cy="140" r="280" stroke-dasharray="6,6" />
      <circle cx="600" cy="140" r="380" />
      <circle cx="600" cy="1580" r="220" />
      <circle cx="600" cy="1580" r="320" stroke-dasharray="8,8" />
    </g>

    <!-- 3. Ornate Mughal Arch Border Lines Around Window -->
    <path d="M 120 400 
             Q 120 180 350 140 
             Q 600 40 850 140 
             Q 1080 180 1080 400 
             L 1080 1140 
             Q 600 1160 120 1140 Z" 
          fill="none" stroke="url(#goldGrad)" stroke-width="7" stroke-linejoin="round" />
    <path d="M 105 400 
             Q 105 165 345 125 
             Q 600 25 855 125 
             Q 1095 165 1095 400 
             L 1095 1155 
             Q 600 1175 105 1155 Z" 
          fill="none" stroke="#caa560" stroke-width="2" opacity="0.6" stroke-dasharray="5,5" />

    <!-- Hanging Toran / Flower Garlands & Hanging Bells -->
    <g stroke="#caa560" stroke-width="1.5" fill="none">
      <line x1="220" y1="0" x2="220" y2="120" />
      <circle cx="220" cy="130" r="9" fill="url(#goldGrad)" stroke="none" />
      <line x1="980" y1="0" x2="980" y2="120" />
      <circle cx="980" cy="130" r="9" fill="url(#goldGrad)" stroke="none" />
      <line x1="380" y1="0" x2="380" y2="70" />
      <circle cx="380" cy="78" r="7" fill="url(#goldGrad)" stroke="none" />
      <line x1="820" y1="0" x2="820" y2="70" />
      <circle cx="820" cy="78" r="7" fill="url(#goldGrad)" stroke="none" />
    </g>

    <!-- Soft Feathering at the base of the photo window -->
    <rect x="110" y="960" width="980" height="200" fill="url(#softFeather)" />

    <!-- 4. Palace Garden Domes (Chhatris) flanking bottom corners -->
    <g opacity="0.32" fill="#d8cbb5">
      <!-- Left Chhatri Dome -->
      <path d="M 0 1620 C 50 1560, 150 1560, 200 1620 L 200 1800 L 0 1800 Z" />
      <circle cx="100" cy="1540" r="8" fill="url(#goldGrad)" />
      <!-- Right Chhatri Dome -->
      <path d="M 1000 1620 C 1050 1560, 1150 1560, 1200 1620 L 1200 1800 L 1000 1800 Z" />
      <circle cx="1100" cy="1540" r="8" fill="url(#goldGrad)" />
    </g>

    <!-- Foliage / Palm Plants flanking the couple -->
    <g opacity="0.45" fill="#2d523b">
      <path d="M 80 1680 C 110 1600, 180 1620, 210 1720 C 180 1740, 120 1740, 80 1680 Z" />
      <path d="M 1120 1680 C 1090 1600, 1020 1620, 990 1720 C 1020 1740, 1080 1740, 1120 1680 Z" />
    </g>

    <!-- 5. Stylized Bride & Groom Wedding Caricature (Center Bottom) -->
    <g transform="translate(600, 1370) scale(1.15)">
      <!-- Groom (Right / Behind) -->
      <g transform="translate(45, -130)">
        <!-- Head / Hair -->
        <ellipse cx="0" cy="0" rx="22" ry="26" fill="#f0d5be" />
        <path d="M -22 -6 C -20 -30, 20 -30, 22 -6 C 18 -18, -18 -18, -22 -6 Z" fill="#1f1813" />
        <!-- Emerald Sherwani with mandarin collar -->
        <path d="M -28 26 L -36 120 L 36 120 L 28 26 L 12 18 L -12 18 Z" fill="url(#emeraldGrad)" />
        <line x1="0" y1="20" x2="0" y2="120" stroke="url(#goldGrad)" stroke-width="2" />
        <circle cx="0" cy="35" r="2.5" fill="url(#goldGrad)" />
        <circle cx="0" cy="55" r="2.5" fill="url(#goldGrad)" />
        <circle cx="0" cy="75" r="2.5" fill="url(#goldGrad)" />
      </g>

      <!-- Bride (Left / Front) -->
      <g transform="translate(-40, -115)">
        <!-- Head / Hair / Maang Tikka -->
        <ellipse cx="0" cy="0" rx="20" ry="24" fill="#f5dcce" />
        <!-- Flowing dark hair -->
        <path d="M -20 -5 C -24 -32, 24 -32, 20 -5 C 24 15, 20 50, 15 65 C 10 30, 18 10, 14 0 C 10 -15, -10 -15, -14 0 C -18 10, -10 30, -15 65 C -20 50, -24 15, -20 -5 Z" fill="#1c1613" />
        <circle cx="0" cy="-12" r="3" fill="url(#goldGrad)" />
        <line x1="0" y1="-22" x2="0" y2="-12" stroke="url(#goldGrad)" stroke-width="1.5" />
        <!-- Emerald Lehenga Blouse -->
        <path d="M -24 24 L -30 65 L 30 65 L 24 24 Z" fill="url(#emeraldGrad)" />
        <!-- Gold Choker Necklace -->
        <path d="M -14 24 Q 0 32 14 24" fill="none" stroke="url(#goldGrad)" stroke-width="3" />
        <!-- Flared Emerald Lehenga Skirt -->
        <path d="M -30 65 L -75 145 L 75 145 L 30 65 Z" fill="url(#emeraldGrad)" />
        <!-- Gold Border on Skirt -->
        <path d="M -73 140 L 73 140" stroke="url(#goldGrad)" stroke-width="5" />
        <!-- Draped Mustard/Orange Zari Dupatta -->
        <path d="M 8 20 C 35 40, 50 80, 40 145 L 18 145 C 28 90, 15 50, -6 30 Z" fill="url(#mustardGrad)" />
      </g>
    </g>

    <!-- 6. Elegant Royal Typography -->
    <g text-anchor="middle">
      ${names ? `
      <!-- Optional Couple Names -->
      <text x="600" y="1570" font-family="'Playfair Display', Georgia, serif" font-size="34" font-weight="700" fill="#7a5a22" letter-spacing="2">
        ${names}
      </text>
      ` : ''}

      <!-- Main Headline: "Thank You for Attending Our Wedding" -->
      <text x="600" y="${names ? '1625' : '1595'}" font-family="'Playfair Display', Georgia, serif" font-size="44" font-weight="bold" font-style="italic" fill="#694c1a" letter-spacing="1">
        ${headline}
      </text>

      <!-- Subtitle Message Line 1 -->
      <text x="600" y="${names ? '1675' : '1650'}" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-size="24" font-weight="600" fill="#58401a" letter-spacing="0.5">
        ${sub1}
      </text>

      <!-- Subtitle Message Line 2 -->
      <text x="600" y="${names ? '1715' : '1690'}" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-size="23" font-weight="500" fill="#634920" letter-spacing="0.5">
        ${sub2}
      </text>

      ${date ? `
      <!-- Event Date -->
      <text x="600" y="${names ? '1755' : '1735'}" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="600" fill="#8c6a28" letter-spacing="2">
        ${date}
      </text>
      ` : ''}
    </g>
  </svg>`;
}

/**
 * Royal Mandap & Floral Garlands (Portrait 4×6)
 * Ornate gold palace pillars, marigold garlands, and regal monogram crest
 */
function getRoyalMandapPortraitSvg(opts?: { headline?: string; subtitle?: string; date?: string }): string {
  const headline = opts?.headline || 'With Love & Gratitude';
  const sub = opts?.subtitle || 'Thank you for blessing us with your presence';
  const date = opts?.date || '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" width="1200" height="1800">
    <defs>
      <mask id="mandapMask">
        <rect width="1200" height="1800" fill="white" />
        <rect x="120" y="160" width="960" height="1100" rx="28" fill="black" />
      </mask>
      <linearGradient id="mandapGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0be53" />
        <stop offset="50%" stop-color="#fff1bd" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>
    </defs>
    <rect width="1200" height="1800" fill="#10111a" mask="url(#mandapMask)" />
    <!-- Pillar Borders -->
    <rect x="120" y="160" width="960" height="1100" rx="28" fill="none" stroke="url(#mandapGold)" stroke-width="8" />
    <rect x="140" y="180" width="920" height="1060" rx="20" fill="none" stroke="#e0be53" stroke-width="2" opacity="0.6" stroke-dasharray="8,8" />
    <!-- Top Floral Marigold Toran -->
    <path d="M 120 160 Q 360 260 600 160 Q 840 260 1080 160" fill="none" stroke="#f59e0b" stroke-width="14" stroke-linecap="round" />
    <path d="M 120 160 Q 360 260 600 160 Q 840 260 1080 160" fill="none" stroke="#ef4444" stroke-width="6" stroke-dasharray="14,14" />
    <!-- Bottom Monogram & Text -->
    <g text-anchor="middle">
      <circle cx="600" cy="1400" r="45" fill="none" stroke="url(#mandapGold)" stroke-width="3" />
      <text x="600" y="1412" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="url(#mandapGold)">✨</text>
      <text x="600" y="1520" font-family="'Playfair Display', Georgia, serif" font-size="46" font-weight="bold" font-style="italic" fill="#ffffff">
        ${headline}
      </text>
      <text x="600" y="1580" font-family="sans-serif" font-size="22" font-weight="500" fill="#a1a1aa">
        ${sub}
      </text>
      ${date ? `<text x="600" y="1630" font-family="monospace" font-size="20" fill="#e0be53" letter-spacing="2">${date}</text>` : ''}
    </g>
  </svg>`;
}

/**
 * Birthday & Party Celebration Card (Portrait 4×6)
 * Balloons, gold confetti, festive celebration banner
 */
function getBirthdayPortraitSvg(opts?: { headline?: string; subtitle?: string; date?: string }): string {
  const headline = opts?.headline || 'Happy Birthday!';
  const sub = opts?.subtitle || 'Thank You for Celebrating With Us 🎉';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" width="1200" height="1800">
    <defs>
      <mask id="bdayMask">
        <rect width="1200" height="1800" fill="white" />
        <rect x="100" y="180" width="1000" height="1140" rx="36" fill="black" />
      </mask>
      <linearGradient id="partyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ec4899" />
        <stop offset="50%" stop-color="#8b5cf6" />
        <stop offset="100%" stop-color="#3b82f6" />
      </linearGradient>
    </defs>
    <rect width="1200" height="1800" fill="#090a14" mask="url(#bdayMask)" />
    <rect x="100" y="180" width="1000" height="1140" rx="36" fill="none" stroke="url(#partyGrad)" stroke-width="8" />
    <!-- Floating Balloons top -->
    <circle cx="200" cy="110" r="45" fill="#ec4899" opacity="0.85" />
    <circle cx="280" cy="80" r="55" fill="#8b5cf6" opacity="0.85" />
    <circle cx="950" cy="110" r="48" fill="#3b82f6" opacity="0.85" />
    <circle cx="1020" cy="75" r="42" fill="#ec4899" opacity="0.85" />
    <!-- Bottom text banner -->
    <g text-anchor="middle">
      <text x="600" y="1490" font-family="'Arial Black', sans-serif" font-size="52" font-weight="900" fill="url(#partyGrad)">
        ${headline}
      </text>
      <text x="600" y="1560" font-family="sans-serif" font-size="26" font-weight="600" fill="#f43f5e">
        ${sub}
      </text>
    </g>
  </svg>`;
}

// ─── 2. LANDSCAPE 6×4 PRESETS (1800 × 1200 px) ───────────────────────────────

/**
 * Traditional Indian Wedding Side-by-Side (Landscape 6×4)
 * Ideal for wide family group photos:
 * - Left 66% (1100×1080 px): Wide family photo slot with gold filigree frame
 * - Right 34%: Royal arch, couple caricature, "Thank You for Attending Our Wedding", couple names & date
 */
function getIndianWeddingLandscapeSvg(opts?: { headline?: string; subtitle?: string; names?: string; date?: string }): string {
  const headline = opts?.headline || 'Thank You for Attending Our Wedding';
  const sub = opts?.subtitle || 'Our day was made special by your presence.';
  const names = opts?.names || 'Rahul & Priya';
  const date = opts?.date || '18 November 2026';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1200" width="1800" height="1200">
    <defs>
      <!-- Cutout mask: white covers background, black cuts out left family photo window -->
      <mask id="landscapeArchMask">
        <rect width="1800" height="1200" fill="white" />
        <!-- Wide Family Photo Cutout (Left Side) -->
        <rect x="60" y="60" width="1120" height="1080" rx="28" fill="black" />
      </mask>

      <linearGradient id="lsGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#d4af37" />
        <stop offset="50%" stop-color="#f3e5ab" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>

      <linearGradient id="lsEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a3925" />
        <stop offset="100%" stop-color="#145a3c" />
      </linearGradient>

      <linearGradient id="lsMustardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e89d14" />
        <stop offset="100%" stop-color="#cc8100" />
      </linearGradient>
    </defs>

    <!-- 1. Background Masked for Left Photo Window -->
    <rect width="1800" height="1200" fill="#f8f4ec" mask="url(#landscapeArchMask)" />

    <!-- 2. Gold Filigree Border Around Left Family Photo Window -->
    <rect x="60" y="60" width="1120" height="1080" rx="28" fill="none" stroke="url(#lsGoldGrad)" stroke-width="7" />
    <rect x="75" y="75" width="1090" height="1050" rx="20" fill="none" stroke="#caa560" stroke-width="2" opacity="0.6" stroke-dasharray="6,6" />

    <!-- Corner Ornaments on Left Photo Window -->
    <circle cx="60" cy="60" r="14" fill="url(#lsGoldGrad)" />
    <circle cx="1180" cy="60" r="14" fill="url(#lsGoldGrad)" />
    <circle cx="60" cy="1140" r="14" fill="url(#lsGoldGrad)" />
    <circle cx="1180" cy="1140" r="14" fill="url(#lsGoldGrad)" />

    <!-- 3. Right Panel: Royal Wedding Invitation Column -->
    <g transform="translate(1490, 0)">
      <!-- Subtle Mandala background -->
      <g opacity="0.16" stroke="#caa560" stroke-width="1.5" fill="none">
        <circle cx="0" cy="220" r="160" />
        <circle cx="0" cy="220" r="260" stroke-dasharray="6,6" />
      </g>

      <!-- Top Royal Arch Motif -->
      <path d="M -240 60 Q 0 -20 240 60" fill="none" stroke="url(#lsGoldGrad)" stroke-width="4" />
      <circle cx="0" cy="40" r="8" fill="url(#lsGoldGrad)" />

      <!-- Stylized Bride & Groom Caricature (Upper Right) -->
      <g transform="translate(0, 310) scale(1.15)">
        <!-- Groom (Right) -->
        <g transform="translate(38, -110)">
          <ellipse cx="0" cy="0" rx="19" ry="23" fill="#f0d5be" />
          <path d="M -19 -5 C -18 -26, 18 -26, 19 -5 Z" fill="#1f1813" />
          <path d="M -24 23 L -30 100 L 30 100 L 24 23 Z" fill="url(#lsEmeraldGrad)" />
          <line x1="0" y1="18" x2="0" y2="100" stroke="url(#lsGoldGrad)" stroke-width="2" />
        </g>
        <!-- Bride (Left) -->
        <g transform="translate(-35, -95)">
          <ellipse cx="0" cy="0" rx="18" ry="22" fill="#f5dcce" />
          <path d="M -18 -4 C -21 -28, 21 -28, 18 -4 Z" fill="#1c1613" />
          <circle cx="0" cy="-10" r="2.5" fill="url(#lsGoldGrad)" />
          <!-- Emerald Lehenga & Mustard Dupatta -->
          <path d="M -22 22 L -26 55 L 26 55 L 22 22 Z" fill="url(#lsEmeraldGrad)" />
          <path d="M -26 55 L -65 125 L 65 125 L 26 55 Z" fill="url(#lsEmeraldGrad)" />
          <path d="M -63 120 L 63 120" stroke="url(#lsGoldGrad)" stroke-width="4" />
          <path d="M 6 18 C 30 35, 42 70, 35 125 L 15 125 C 22 80, 12 45, -5 28 Z" fill="url(#lsMustardGrad)" />
        </g>
      </g>

      <!-- Couple Names Banner -->
      <g text-anchor="middle">
        <text x="0" y="550" font-family="'Playfair Display', Georgia, serif" font-size="36" font-weight="bold" fill="#7a5a22" letter-spacing="2">
          ${names}
        </text>

        <!-- Divider Line with Diamond -->
        <line x1="-120" y1="585" x2="120" y2="585" stroke="url(#lsGoldGrad)" stroke-width="2" />
        <rect x="-6" y="579" width="12" height="12" fill="url(#lsGoldGrad)" transform="rotate(45)" />

        <!-- Headline: "Thank You for Attending Our Wedding" -->
        <text x="0" y="660" font-family="'Playfair Display', Georgia, serif" font-size="30" font-weight="bold" font-style="italic" fill="#694c1a">
          ${headline}
        </text>

        <!-- Subtitle message -->
        <text x="0" y="730" font-family="'Cinzel', Georgia, serif" font-size="19" font-weight="600" fill="#58401a">
          ${sub}
        </text>
        <text x="0" y="770" font-family="'Cinzel', Georgia, serif" font-size="18" font-weight="500" fill="#634920">
          Deeply grateful for your love & blessings.
        </text>

        <!-- Wedding Date -->
        <text x="0" y="850" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="#8c6a28" letter-spacing="2">
          ${date}
        </text>

        <!-- Palace Domes Motif at Bottom -->
        <g opacity="0.3" fill="#d8cbb5" transform="translate(0, 1050)">
          <path d="M -120 40 C -80 -10, 80 -10, 120 40 Z" />
          <circle cx="0" cy="-14" r="6" fill="url(#lsGoldGrad)" />
        </g>
      </g>
    </g>
  </svg>`;
}

/**
 * Royal Mandap Panoramic (Landscape 6×4)
 * Top marigold toran, wide center family window, bottom royal band
 */
function getRoyalMandapLandscapeSvg(opts?: { headline?: string; subtitle?: string; date?: string }): string {
  const headline = opts?.headline || 'With Love & Gratitude • Thank You for Celebrating With Us';
  const date = opts?.date || '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1200" width="1800" height="1200">
    <defs>
      <mask id="lsMandapMask">
        <rect width="1800" height="1200" fill="white" />
        <rect x="80" y="120" width="1640" height="920" rx="24" fill="black" />
      </mask>
      <linearGradient id="lsMandapGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0be53" />
        <stop offset="50%" stop-color="#fff1bd" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>
    </defs>
    <rect width="1800" height="1200" fill="#0d0e17" mask="url(#lsMandapMask)" />
    <rect x="80" y="120" width="1640" height="920" rx="24" fill="none" stroke="url(#lsMandapGold)" stroke-width="7" />
    <!-- Top Garland -->
    <path d="M 80 120 Q 500 180 900 120 Q 1300 180 1720 120" fill="none" stroke="#f59e0b" stroke-width="12" stroke-linecap="round" />
    <!-- Bottom Bar -->
    <g text-anchor="middle">
      <text x="900" y="1120" font-family="'Playfair Display', Georgia, serif" font-size="34" font-weight="bold" fill="#ffffff">
        ${headline}
      </text>
      ${date ? `<text x="900" y="1165" font-family="monospace" font-size="20" fill="#e0be53" letter-spacing="2">${date}</text>` : ''}
    </g>
  </svg>`;
}

// ─── 3. EXPORTED TEMPLATES REGISTRY ───────────────────────────────────────────

export const CARD_TEMPLATES_PORTRAIT: CardTemplate[] = [
  {
    id: 'indian-wedding-portrait',
    name: 'Royal Indian Wedding (Arch & Caricature)',
    orientation: 'portrait',
    category: 'wedding',
    badge: 'Traditional Wedding',
    description: 'Ornate Mughal arch, mandala wallpaper, bride & groom caricature, and thank-you calligraphy',
    headlineDefault: 'Thank You for Attending Our Wedding',
    subtitleDefault: 'Our day was made special by your presence.',
    photoSlot: { x: 120, y: 140, width: 960, height: 1000, featherBottom: true },
    getOverlaySvg: getIndianWeddingPortraitSvg,
  },
  {
    id: 'royal-mandap-portrait',
    name: 'Royal Mandap & Floral Garland',
    orientation: 'portrait',
    category: 'wedding',
    badge: 'Royal Mandap',
    description: 'Gold palace pillars, marigold garlands, and royal crest',
    headlineDefault: 'With Love & Gratitude',
    subtitleDefault: 'Thank you for blessing us with your presence',
    photoSlot: { x: 120, y: 160, width: 960, height: 1100 },
    getOverlaySvg: getRoyalMandapPortraitSvg,
  },
  {
    id: 'birthday-celebration-portrait',
    name: 'Celebration Confetti & Balloons',
    orientation: 'portrait',
    category: 'celebration',
    badge: 'Birthday / Party',
    description: 'Vibrant balloons, gold sparkle confetti, and celebratory banner',
    headlineDefault: 'Happy Birthday!',
    subtitleDefault: 'Thank You for Celebrating With Us 🎉',
    photoSlot: { x: 100, y: 180, width: 1000, height: 1140, radius: 36 },
    getOverlaySvg: getBirthdayPortraitSvg,
  },
];

export const CARD_TEMPLATES_LANDSCAPE: CardTemplate[] = [
  {
    id: 'indian-wedding-landscape',
    name: 'Royal Indian Wedding (Side-by-Side)',
    orientation: 'landscape',
    category: 'wedding',
    badge: 'Family Group Favorite',
    description: 'Wide family photo slot on left (1120×1080) + Royal bride & groom illustration & message on right',
    headlineDefault: 'Thank You for Attending Our Wedding',
    subtitleDefault: 'Our day was made special by your presence.',
    photoSlot: { x: 60, y: 60, width: 1120, height: 1080, radius: 28 },
    getOverlaySvg: getIndianWeddingLandscapeSvg,
  },
  {
    id: 'royal-mandap-landscape',
    name: 'Royal Mandap Panoramic (Wide)',
    orientation: 'landscape',
    category: 'wedding',
    badge: 'Mandap Panoramic',
    description: 'Wide panoramic group photo framed in gold pillars and marigold floral toran',
    headlineDefault: 'With Love & Gratitude • Thank You for Celebrating With Us',
    photoSlot: { x: 80, y: 120, width: 1640, height: 920, radius: 24 },
    getOverlaySvg: getRoyalMandapLandscapeSvg,
  },
];

/**
 * Find a template by its ID (checking both portrait and landscape sets)
 */
export function getCardTemplateById(id: string): CardTemplate | undefined {
  return (
    CARD_TEMPLATES_PORTRAIT.find((t) => t.id === id) ||
    CARD_TEMPLATES_LANDSCAPE.find((t) => t.id === id)
  );
}

/**
 * Composite a photo blob with a 4×6 / 6×4 commemorative card template
 * Output is guaranteed to be exact 1200×1800 (portrait) or 1800×1200 (landscape)
 * at 300 DPI equivalent for lab-quality printing.
 */
export async function compositeCardPhoto(
  photoBlob: Blob,
  template: CardTemplate,
  opts?: { headline?: string; subtitle?: string; names?: string; date?: string }
): Promise<Blob> {
  const isLandscape = template.orientation === 'landscape';
  const targetW = isLandscape ? 1800 : 1200;
  const targetH = isLandscape ? 1200 : 1800;

  return new Promise((resolve) => {
    const photo = new Image();
    photo.crossOrigin = 'anonymous';

    photo.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;

      // 1. Draw photo in the designated slot with smart cover cropping
      const slot = template.photoSlot;
      const slotAspect = slot.width / slot.height;
      const photoAspect = photo.naturalWidth / photo.naturalHeight;

      let sx = 0, sy = 0, sWidth = photo.naturalWidth, sHeight = photo.naturalHeight;

      if (photoAspect > slotAspect) {
        // Photo is wider than slot: crop sides
        sWidth = photo.naturalHeight * slotAspect;
        sx = (photo.naturalWidth - sWidth) / 2;
      } else {
        // Photo is taller than slot: crop top/bottom
        sHeight = photo.naturalWidth / slotAspect;
        sy = (photo.naturalHeight - sHeight) / 2;
      }

      // Draw photo directly into the slot
      ctx.save();
      if (slot.radius) {
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.radius);
        ctx.clip();
      }
      ctx.drawImage(photo, sx, sy, sWidth, sHeight, slot.x, slot.y, slot.width, slot.height);
      ctx.restore();

      // 2. Render SVG overlay on top across full 1200×1800 / 1800×1200 canvas
      const overlaySvg = template.getOverlaySvg(opts);
      const overlayImg = new Image();
      const svgBlob = new Blob([overlaySvg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      overlayImg.onload = () => {
        ctx.drawImage(overlayImg, 0, 0, targetW, targetH);
        URL.revokeObjectURL(svgUrl);

        canvas.toBlob(
          (compositedBlob) => {
            resolve(compositedBlob || photoBlob);
          },
          'image/jpeg',
          0.96
        );
      };

      overlayImg.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(
          (compositedBlob) => {
            resolve(compositedBlob || photoBlob);
          },
          'image/jpeg',
          0.96
        );
      };

      overlayImg.src = svgUrl;
    };

    photo.onerror = () => resolve(photoBlob);
    photo.src = URL.createObjectURL(photoBlob);
  });
}

// ─── 5. VISUAL DRAG-AND-DROP CANVAS TEMPLATE ENGINE ─────────────────────────

export interface CanvasTextLayer {
  text: string;
  yPercent: number; // 0-100%
  fontSize: number; // px at 1200x1800 scale
  color: string;
  fontFamily: string;
  enabled: boolean;
  letterSpacing?: number;
}

export interface CanvasTemplateConfig {
  orientation: 'portrait' | 'landscape';
  backgroundTheme: string; // 'dark-gold' | 'ivory-silk' | 'midnight-gala' | 'rose-quartz' | 'clean-studio'
  backgroundColor: string;
  borderColor: string;
  borderWidth: number; // px at scale
  photoSlot: {
    xPercent: number; // 0-100
    yPercent: number; // 0-100
    widthPercent: number; // 0-100
    heightPercent: number; // 0-100
    radius: number; // px
    borderWidth: number;
    borderColor: string;
    shadowBlur: number;
  };
  headline: CanvasTextLayer;
  names: CanvasTextLayer;
  date: CanvasTextLayer;
  hashtag: CanvasTextLayer;
}

export const DEFAULT_CANVAS_CONFIG_PORTRAIT: CanvasTemplateConfig = {
  orientation: 'portrait',
  backgroundTheme: 'dark-gold',
  backgroundColor: '#0d0e15',
  borderColor: '#d4af37',
  borderWidth: 16,
  photoSlot: {
    xPercent: 50,
    yPercent: 44,
    widthPercent: 82,
    heightPercent: 60,
    radius: 28,
    borderWidth: 6,
    borderColor: '#caa560',
    shadowBlur: 35,
  },
  headline: {
    text: 'CELEBRATING THE WEDDING OF',
    yPercent: 10,
    fontSize: 26,
    color: '#caa560',
    fontFamily: 'Cinzel, serif',
    enabled: true,
    letterSpacing: 4,
  },
  names: {
    text: 'Rahul & Priya',
    yPercent: 80,
    fontSize: 54,
    color: '#fde047',
    fontFamily: 'Playfair Display, serif',
    enabled: true,
    letterSpacing: 2,
  },
  date: {
    text: 'November 18, 2026 • Royal Palace, Jaipur',
    yPercent: 87,
    fontSize: 24,
    color: '#e2e8f0',
    fontFamily: 'Montserrat, sans-serif',
    enabled: true,
    letterSpacing: 1,
  },
  hashtag: {
    text: '#RahulWedsPriya',
    yPercent: 93,
    fontSize: 20,
    color: '#caa560',
    fontFamily: 'Montserrat, sans-serif',
    enabled: true,
    letterSpacing: 2,
  },
};

export const DEFAULT_CANVAS_CONFIG_LANDSCAPE: CanvasTemplateConfig = {
  orientation: 'landscape',
  backgroundTheme: 'dark-gold',
  backgroundColor: '#0d0e15',
  borderColor: '#d4af37',
  borderWidth: 16,
  photoSlot: {
    xPercent: 36,
    yPercent: 50,
    widthPercent: 60,
    heightPercent: 78,
    radius: 24,
    borderWidth: 6,
    borderColor: '#caa560',
    shadowBlur: 35,
  },
  headline: {
    text: 'CELEBRATING THE WEDDING OF',
    yPercent: 24,
    fontSize: 22,
    color: '#caa560',
    fontFamily: 'Cinzel, serif',
    enabled: true,
    letterSpacing: 3,
  },
  names: {
    text: 'Rahul & Priya',
    yPercent: 46,
    fontSize: 48,
    color: '#fde047',
    fontFamily: 'Playfair Display, serif',
    enabled: true,
    letterSpacing: 2,
  },
  date: {
    text: 'November 18, 2026 • Jaipur',
    yPercent: 64,
    fontSize: 22,
    color: '#e2e8f0',
    fontFamily: 'Montserrat, sans-serif',
    enabled: true,
    letterSpacing: 1,
  },
  hashtag: {
    text: '#RahulWedsPriya',
    yPercent: 78,
    fontSize: 20,
    color: '#caa560',
    fontFamily: 'Montserrat, sans-serif',
    enabled: true,
    letterSpacing: 2,
  },
};

/**
 * Composite photo using custom visual canvas designer config
 * Produces crisp 1200x1800 (Portrait) or 1800x1200 (Landscape) JPEG
 */
export async function compositeCustomCanvasTemplate(
  photoBlob: Blob,
  config: CanvasTemplateConfig
): Promise<Blob> {
  const isLandscape = config.orientation === 'landscape';
  const targetW = isLandscape ? 1800 : 1200;
  const targetH = isLandscape ? 1200 : 1800;

  return new Promise((resolve) => {
    const photo = new Image();
    photo.crossOrigin = 'anonymous';

    photo.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;

      // 1. Draw Background
      ctx.fillStyle = config.backgroundColor || '#0d0e15';
      ctx.fillRect(0, 0, targetW, targetH);

      // Luxury Background Accents
      if (config.backgroundTheme === 'dark-gold') {
        const grad = ctx.createLinearGradient(0, 0, targetW, targetH);
        grad.addColorStop(0, '#161824');
        grad.addColorStop(0.5, '#0b0c13');
        grad.addColorStop(1, '#1b1a29');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (config.backgroundTheme === 'ivory-silk') {
        const grad = ctx.createLinearGradient(0, 0, targetW, targetH);
        grad.addColorStop(0, '#faf7f2');
        grad.addColorStop(0.5, '#f4ece1');
        grad.addColorStop(1, '#ede2d1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (config.backgroundTheme === 'midnight-gala') {
        const grad = ctx.createRadialGradient(targetW / 2, targetH / 2, 100, targetW / 2, targetH / 2, targetW);
        grad.addColorStop(0, '#1a1836');
        grad.addColorStop(1, '#07060f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetW, targetH);
      }

      // Outer Card Border
      if (config.borderWidth > 0) {
        ctx.strokeStyle = config.borderColor || '#d4af37';
        ctx.lineWidth = config.borderWidth;
        const inset = config.borderWidth / 2 + 10;
        ctx.strokeRect(inset, inset, targetW - inset * 2, targetH - inset * 2);

        // Thin inner decorative hairline
        ctx.lineWidth = 2;
        ctx.strokeStyle = (config.borderColor || '#d4af37') + '88';
        const innerInset = inset + 12;
        ctx.strokeRect(innerInset, innerInset, targetW - innerInset * 2, targetH - innerInset * 2);
      }

      // 2. Draw Photo Slot
      const slot = config.photoSlot;
      const slotW = (slot.widthPercent / 100) * targetW;
      const slotH = (slot.heightPercent / 100) * targetH;
      const slotX = (slot.xPercent / 100) * targetW - slotW / 2;
      const slotY = (slot.yPercent / 100) * targetH - slotH / 2;

      // Photo Slot Shadow
      if (slot.shadowBlur > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = slot.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(slotX, slotY, slotW, slotH, slot.radius || 0);
        ctx.fill();
        ctx.restore();
      }

      // Draw Photo Inside Slot (Smart Cover)
      const slotAspect = slotW / slotH;
      const photoAspect = photo.naturalWidth / photo.naturalHeight;
      let sx = 0, sy = 0, sWidth = photo.naturalWidth, sHeight = photo.naturalHeight;

      if (photoAspect > slotAspect) {
        sWidth = photo.naturalHeight * slotAspect;
        sx = (photo.naturalWidth - sWidth) / 2;
      } else {
        sHeight = photo.naturalWidth / slotAspect;
        sy = (photo.naturalHeight - sHeight) / 2;
      }

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(slotX, slotY, slotW, slotH, slot.radius || 0);
      ctx.clip();
      ctx.drawImage(photo, sx, sy, sWidth, sHeight, slotX, slotY, slotW, slotH);
      ctx.restore();

      // Photo Slot Border
      if (slot.borderWidth > 0) {
        ctx.save();
        ctx.strokeStyle = slot.borderColor || '#caa560';
        ctx.lineWidth = slot.borderWidth;
        ctx.beginPath();
        ctx.roundRect(slotX, slotY, slotW, slotH, slot.radius || 0);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Render Text Layers
      const textLayers = [config.headline, config.names, config.date, config.hashtag];
      textLayers.forEach((layer) => {
        if (!layer || !layer.enabled || !layer.text) return;

        ctx.save();
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.font = `600 ${layer.fontSize}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Letter spacing if supported
        if (layer.letterSpacing && 'letterSpacing' in ctx) {
          (ctx as any).letterSpacing = `${layer.letterSpacing}px`;
        }

        const textX = isLandscape && config.photoSlot.xPercent < 50
          ? targetW * 0.77 // In landscape with left photo, place text on right side
          : targetW / 2;
        const textY = (layer.yPercent / 100) * targetH;

        // Subtle drop shadow for crisp readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        ctx.fillText(layer.text, textX, textY);
        ctx.restore();
      });

      canvas.toBlob(
        (compositedBlob) => {
          resolve(compositedBlob || photoBlob);
        },
        'image/jpeg',
        0.96
      );
    };

    photo.onerror = () => resolve(photoBlob);
    photo.src = URL.createObjectURL(photoBlob);
  });
}
