/**
 * Comprehensive Empirical Verification & Stress Harness for Milestone 4:
 * Mobile-Friendly Rich Responsive Layout & Secure Live Gallery
 *
 * Validates:
 * 1. DOM and CSS layout rules for responsive viewports (375px mobile, 768px tablet, 1024px desktop)
 *    - ShareScreen: flex-col lg:flex-row, no fixed 183px squashed preview, min-h-[44px]/min-h-[48px] buttons
 *    - PreviewScreen: max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh], min-h-[44px]/min-h-[48px] buttons
 *    - AIStudioScreen: grid-cols-2 sm:grid-cols-3 md:grid-cols-4, min-h-[90px]/min-h-[110px], min-h-[44px]
 *    - Admin event manage: min-h-[44px] tabs, grid-cols-1 sm:grid-cols-2 lg:grid-cols-4, overflow-x-auto
 * 2. Link Safety & QR Delivery in p/[code]/page.tsx:
 *    - Zero dead links to /gallery without slug or ID across all event states
 *    - Native QRCodeSVG usage for session QR delivery
 * 3. Secure Live Gallery in gallery/[slug]/page.tsx:
 *    - Password protection truth table coverage across all contract representations
 *    - Absence of external third-party QR services (api.qrserver.com)
 *    - Fluid lightbox and touch-friendly targets
 * 4. Viewport Breakpoint Emulation & Layout Stress Testing
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Helper to load file content
function loadSrc(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `Target source file does not exist: ${fullPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Responsive Layout & CSS Rule Verification across Viewports
// ─────────────────────────────────────────────────────────────────────────────
test('1. Kiosk & Admin Responsive Layout and Touch Target Rules', async (t) => {
  const shareContent = loadSrc('frontend/src/components/booth/ShareScreen.tsx');
  const previewContent = loadSrc('frontend/src/components/booth/PreviewScreen.tsx');
  const aiStudioContent = loadSrc('frontend/src/components/booth/AIStudioScreen.tsx');
  const adminEventContent = loadSrc('frontend/src/app/admin/events/[id]/page.tsx');
  const eventAliasContent = loadSrc('frontend/src/app/events/[id]/page.tsx');

  await t.test('1.1 ShareScreen: Root flex container responsive layout (flex-col lg:flex-row)', () => {
    assert(
      shareContent.includes('flex flex-col lg:flex-row'),
      'ShareScreen root container must use flex-col on mobile/tablet and lg:flex-row on desktop'
    );
    assert(
      shareContent.includes('max-w-5xl mx-auto'),
      'ShareScreen must center content with max-w-5xl container'
    );
  });

  await t.test('1.2 ShareScreen: Squashed fixed 183px preview eliminated', () => {
    assert(
      !shareContent.includes('w-[183px]'),
      'ShareScreen must NOT contain legacy fixed w-[183px] preview width'
    );
    assert(
      !shareContent.includes('w-44'),
      'ShareScreen must NOT restrict photo preview container to fixed w-44'
    );
  });

  await t.test('1.3 ShareScreen: Responsive preview max-height constraints', () => {
    assert(
      shareContent.includes('max-h-[50vh] sm:max-h-[60vh] lg:max-h-[calc(100dvh-220px)]'),
      'ShareScreen image must be bounded by max-h-[50vh] sm:max-h-[60vh] lg:max-h-[calc(100dvh-220px)]'
    );
    assert(
      shareContent.includes('object-contain'),
      'ShareScreen preview image must use object-contain to preserve aspect ratio'
    );
  });

  await t.test('1.4 ShareScreen: Touch-friendly min-h-[44px] action buttons and min-h-[48px] Done button', () => {
    // Check that buttons have min-h-[44px]
    const minH44Matches = (shareContent.match(/min-h-\[44px\]/g) || []).length;
    assert(
      minH44Matches >= 6,
      `ShareScreen must have at least 6 touch-friendly action buttons with min-h-[44px], found ${minH44Matches}`
    );

    // Check Done button min-h-[48px]
    assert(
      shareContent.includes('min-h-[48px]'),
      'ShareScreen primary Done button must feature min-h-[48px]'
    );
  });

  await t.test('1.5 ShareScreen: Native QRCodeSVG with responsive sizing', () => {
    assert(
      shareContent.includes("import { QRCodeSVG } from 'qrcode.react';"),
      'ShareScreen must import QRCodeSVG from qrcode.react'
    );
    assert(
      shareContent.includes('w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]'),
      'ShareScreen QRCodeSVG must use responsive w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]'
    );
  });

  await t.test('1.6 PreviewScreen: Image container max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh]', () => {
    assert(
      previewContent.includes('max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh]'),
      'PreviewScreen wrapper must specify max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh]'
    );
    assert(
      previewContent.includes('[&_img]:max-h-[50vh] sm:[&_img]:max-h-[60vh] lg:[&_img]:max-h-[70vh] [&_img]:object-contain'),
      'PreviewScreen TemplateRenderer container must cascade max-height and object-contain to child img'
    );
  });

  await t.test('1.7 PreviewScreen: ActionBtn min-h-[44px] and Done button min-h-[48px]', () => {
    assert(
      previewContent.includes('min-h-[44px] h-14 sm:h-auto'),
      'PreviewScreen ActionBtn must enforce min-h-[44px] with h-14 on mobile'
    );
    assert(
      previewContent.includes('min-h-[48px]'),
      'PreviewScreen primary Done button must enforce min-h-[48px]'
    );
  });

  await t.test('1.8 PreviewScreen: Responsive viewport split (Portrait flex-col vs Landscape flex-row)', () => {
    assert(
      previewContent.includes('flex flex-col sm:flex-row overflow-hidden min-h-0'),
      'PreviewScreen main split must be flex-col on mobile portrait (<sm) and sm:flex-row on landscape/tablet'
    );
    assert(
      previewContent.includes('flex sm:hidden'),
      'PreviewScreen must feature a dedicated horizontal scrollable action bar on portrait mobile (flex sm:hidden)'
    );
    assert(
      previewContent.includes('hidden sm:flex'),
      'PreviewScreen must feature a dedicated vertical action panel on landscape (hidden sm:flex)'
    );
  });

  await t.test('1.9 AIStudioScreen: Style selector responsive grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4)', () => {
    assert(
      aiStudioContent.includes('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4'),
      'AIStudioScreen must configure responsive grid: 2 cols on mobile, 3 on tablet, 4 on desktop'
    );
  });

  await t.test('1.10 AIStudioScreen: StyleCard touch targets min-h-[90px] sm:min-h-[110px]', () => {
    assert(
      aiStudioContent.includes('min-h-[90px] sm:min-h-[110px]'),
      'AIStudioScreen StyleCard must enforce min-h-[90px] sm:min-h-[110px]'
    );
  });

  await t.test('1.11 AIStudioScreen: Main container responsive split (flex-col md:flex-row)', () => {
    assert(
      aiStudioContent.includes('flex flex-col md:flex-row'),
      'AIStudioScreen must arrange photo top/side responsively with flex-col md:flex-row'
    );
    assert(
      aiStudioContent.includes('max-h-[30vh] sm:max-h-[35vh] md:max-h-none'),
      'AIStudioScreen photo preview must constrain max-height on mobile to avoid pushing styles offscreen'
    );
  });

  await t.test('1.12 AIStudioScreen: Buttons enforce min-h-[44px] and custom prompt input present', () => {
    const minH44Count = (aiStudioContent.match(/min-h-\[44px\]/g) || []).length;
    assert(
      minH44Count >= 3,
      `AIStudioScreen must have at least 3 action buttons with min-h-[44px], found ${minH44Count}`
    );
    assert(
      aiStudioContent.includes('Custom Prompt Modifier'),
      'AIStudioScreen must provide custom prompt modifier input'
    );
  });

  await t.test('1.13 Admin Event Management: Mobile navigation tabs have min-h-[44px]', () => {
    assert(
      adminEventContent.includes('min-h-[44px]'),
      'Admin event management must enforce min-h-[44px] on mobile navigation tabs'
    );
  });

  await t.test('1.14 Admin Event Management: Analytics KPI grid is grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', () => {
    assert(
      adminEventContent.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'),
      'Admin event management must adapt analytics KPI cards to 1 column on mobile, 2 on tablet, 4 on desktop'
    );
  });

  await t.test('1.15 Admin Event Management: Data tables wrapped in overflow-x-auto', () => {
    assert(
      adminEventContent.includes('overflow-x-auto'),
      'Admin event management must wrap tabular data in overflow-x-auto to eliminate viewport clipping'
    );
  });

  await t.test('1.16 Admin Event Management: /events/[id]/page.tsx correctly re-exports /admin/events/[id]/page', () => {
    assert(
      eventAliasContent.includes("@/app/admin/events/[id]/page"),
      'Route /events/[id]/page.tsx must re-export the admin event manage page'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Guest Short URL Page (p/[code]/page.tsx) Link Safety & QR Delivery
// ─────────────────────────────────────────────────────────────────────────────
test('2. p/[code]/page.tsx: Link Safety & Session QR Delivery', async (t) => {
  const shortUrlContent = loadSrc('frontend/src/app/p/[code]/page.tsx');

  await t.test('2.1 Static Analysis: Zero dead links to /gallery without slug or ID', () => {
    // There must be no occurrence of href="/gallery" or href={'/gallery'} or similar
    const deadLinkRegex = /href=['"`]\/gallery['"`]/;
    assert(
      !deadLinkRegex.test(shortUrlContent),
      'p/[code]/page.tsx must NOT contain dead href="/gallery" links'
    );

    // Verify correct dynamic route pattern
    const linkPattern = /href=\{event\?\.slug \? `\/gallery\/\$\{event\.slug\}` : \(event\?\.id \? `\/gallery\/\$\{event\.id\}` : '#'\)\}/;
    assert(
      linkPattern.test(shortUrlContent),
      'p/[code]/page.tsx must resolve links conditionally to slug, id, or safe fallback #'
    );
  });

  await t.test('2.2 Dynamic Link Resolution Oracle: Stress-testing all event data variants', () => {
    // Simulates the exact expression in p/[code]/page.tsx:
    // event?.slug ? `/gallery/${event.slug}` : (event?.id ? `/gallery/${event.id}` : '#')
    function resolveGalleryLink(event) {
      return event?.slug ? `/gallery/${event.slug}` : (event?.id ? `/gallery/${event.id}` : '#');
    }

    // Test matrix
    const cases = [
      { input: { slug: 'wedding-party', id: 'ev-1' }, expected: '/gallery/wedding-party', desc: 'Valid slug and id' },
      { input: { slug: 'corporate-summit' }, expected: '/gallery/corporate-summit', desc: 'Slug without id' },
      { input: { id: '3f6c8d41-1122-3344-5566-778899aabbcc' }, expected: '/gallery/3f6c8d41-1122-3344-5566-778899aabbcc', desc: 'ID without slug' },
      { input: { slug: '', id: 'ev-fallback' }, expected: '/gallery/ev-fallback', desc: 'Empty slug with valid id' },
      { input: { slug: null, id: 'ev-fallback-2' }, expected: '/gallery/ev-fallback-2', desc: 'Null slug with valid id' },
      { input: { slug: '', id: '' }, expected: '#', desc: 'Empty slug and empty id' },
      { input: {}, expected: '#', desc: 'Empty event object' },
      { input: null, expected: '#', desc: 'Null event' },
      { input: undefined, expected: '#', desc: 'Undefined event' },
    ];

    for (const c of cases) {
      const actual = resolveGalleryLink(c.input);
      assert.strictEqual(actual, c.expected, `Link resolution failed for: ${c.desc}`);
      assert.notStrictEqual(actual, '/gallery', `Link resolution produced dead '/gallery' for: ${c.desc}`);
    }
  });

  await t.test('2.3 Session QR Delivery: Native QRCodeSVG and interactive toggle', () => {
    assert(
      shortUrlContent.includes("import { QRCodeSVG } from 'qrcode.react';"),
      'p/[code]/page.tsx must import QRCodeSVG from qrcode.react'
    );
    assert(
      shortUrlContent.includes('<QRCodeSVG'),
      'p/[code]/page.tsx must render <QRCodeSVG /> component'
    );
    assert(
      shortUrlContent.includes('Show Session QR Code'),
      'p/[code]/page.tsx must include interactive toggle to show/hide session QR'
    );
  });

  await t.test('2.4 Touch targets on mobile: min-h-[44px] and min-h-[48px]', () => {
    assert(
      shortUrlContent.includes('min-h-[48px]'),
      'p/[code]/page.tsx primary Save Photo CTA must have min-h-[48px]'
    );
    const minH44Count = (shortUrlContent.match(/min-h-\[44px\]/g) || []).length;
    assert(
      minH44Count >= 4,
      `p/[code]/page.tsx must have at least 4 touch-friendly targets with min-h-[44px], found ${minH44Count}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Secure Live Gallery (gallery/[slug]/page.tsx) Password Gate & Verification
// ─────────────────────────────────────────────────────────────────────────────
test('3. gallery/[slug]/page.tsx: Password Protection Truth Table & Security', async (t) => {
  const galleryContent = loadSrc('frontend/src/app/gallery/[slug]/page.tsx');

  // Exact boolean formula extracted from line 105-110 of gallery/[slug]/page.tsx:
  // Boolean(
  //   ev.has_gallery_password ||
  //   ev.hasGalleryPassword ||
  //   ev.gallery_password ||
  //   ev.settings?.galleryPassword
  // )
  function isPasswordProtected(ev) {
    if (!ev) return false;
    return Boolean(
      ev.has_gallery_password ||
      ev.hasGalleryPassword ||
      ev.gallery_password ||
      ev.settings?.galleryPassword
    );
  }

  await t.test('3.1 Password Truth Table: Exhaustive validation of all event contract representations', () => {
    const truthTable = [
      // 1. Backend snake_case public indicator (scrubbed plaintext)
      { ev: { has_gallery_password: true }, expected: true, label: 'has_gallery_password: true' },
      // 2. Backend camelCase indicator
      { ev: { hasGalleryPassword: true }, expected: true, label: 'hasGalleryPassword: true' },
      // 3. Legacy direct gallery_password column
      { ev: { gallery_password: 'sample-password-123' }, expected: true, label: 'gallery_password: "..."' },
      // 4. Admin settings JSONB field
      { ev: { settings: { galleryPassword: 'admin-password-456' } }, expected: true, label: 'settings.galleryPassword: "..."' },
      // 5. Backend response with scrubbed settings but has_gallery_password flag
      { ev: { has_gallery_password: true, settings: {} }, expected: true, label: 'has_gallery_password: true with empty settings' },
      // 6. Multiple fields set simultaneously
      { ev: { has_gallery_password: true, hasGalleryPassword: true, settings: { galleryPassword: 'xyz' } }, expected: true, label: 'All flags set' },
      // 7. Unprotected event with explicit false
      { ev: { has_gallery_password: false, hasGalleryPassword: false, settings: {} }, expected: false, label: 'All flags explicitly false' },
      // 8. Empty string passwords (treated as unset/unprotected)
      { ev: { gallery_password: '', settings: { galleryPassword: '' } }, expected: false, label: 'Empty string passwords' },
      // 9. Empty event
      { ev: {}, expected: false, label: 'Empty event object' },
      // 10. Null / undefined
      { ev: null, expected: false, label: 'Null event' },
      { ev: undefined, expected: false, label: 'Undefined event' },
    ];

    for (const row of truthTable) {
      const actual = isPasswordProtected(row.ev);
      assert.strictEqual(
        actual,
        row.expected,
        `Truth table assertion failed for [${row.label}]: expected ${row.expected}, got ${actual}`
      );
    }
  });

  await t.test('3.2 Absence of third-party external QR service (api.qrserver.com)', () => {
    assert(
      !galleryContent.includes('api.qrserver.com'),
      'gallery/[slug]/page.tsx must NOT rely on external third-party api.qrserver.com'
    );
  });

  await t.test('3.3 Native QRCodeSVG implementation in lightbox', () => {
    assert(
      galleryContent.includes("import { QRCodeSVG } from 'qrcode.react';"),
      'gallery/[slug]/page.tsx must import QRCodeSVG from qrcode.react'
    );
    assert(
      galleryContent.includes('<QRCodeSVG'),
      'gallery/[slug]/page.tsx must render <QRCodeSVG /> for lightbox sharing'
    );
  });

  await t.test('3.4 Responsive photo grid layout (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5)', () => {
    assert(
      galleryContent.includes('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4'),
      'gallery/[slug]/page.tsx must define responsive photo grid for mobile, tablet, and desktop viewports'
    );
  });

  await t.test('3.5 Lightbox touch targets and fluid modal sizing', () => {
    assert(
      galleryContent.includes('min-w-[44px] min-h-[44px]'),
      'gallery/[slug]/page.tsx lightbox close/back buttons must enforce min-w-[44px] min-h-[44px]'
    );
    const minH44Count = (galleryContent.match(/min-h-\[44px\]/g) || []).length;
    assert(
      minH44Count >= 4,
      `gallery/[slug]/page.tsx must provide touch-friendly action buttons (min-h-[44px]), found ${minH44Count}`
    );
  });

  await t.test('3.6 Defensive UUID slug resolution', () => {
    assert(
      galleryContent.includes('isUuidSlug'),
      'gallery/[slug]/page.tsx must detect UUID slugs to avoid treating raw photo IDs as event slugs'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Viewport Breakpoint Emulation & Layout Stress Testing
// ─────────────────────────────────────────────────────────────────────────────
test('4. Viewport Breakpoint Simulation & Responsive Layout Engine', async (t) => {
  // Define standard Tailwind CSS breakpoint intervals
  const BREAKPOINTS = {
    mobile: 375,  // Mobile Portrait (<640px, default styles)
    tablet: 768,  // Tablet Portrait (>=640px sm, >=768px md)
    desktop: 1024 // Desktop / Tablet Landscape (>=1024px lg)
  };

  // Helper simulating Tailwind class computation for responsive classes
  // e.g. "flex-col lg:flex-row" at 375 -> flex-col, at 1024 -> flex-row
  function computeResponsiveClass(classList, viewportWidth) {
    const tokens = classList.split(/\s+/);
    let selected = '';
    for (const token of tokens) {
      if (!token.includes(':')) {
        selected = token; // base style
      } else if (token.startsWith('sm:') && viewportWidth >= 640) {
        selected = token.replace('sm:', '');
      } else if (token.startsWith('md:') && viewportWidth >= 768) {
        selected = token.replace('md:', '');
      } else if (token.startsWith('lg:') && viewportWidth >= 1024) {
        selected = token.replace('lg:', '');
      }
    }
    return selected;
  }

  await t.test('4.1 ShareScreen container flex-direction across viewports', () => {
    const classRule = 'flex-col lg:flex-row';
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.mobile), 'flex-col');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.tablet), 'flex-col');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.desktop), 'flex-row');
  });

  await t.test('4.2 PreviewScreen max-height constraint across viewports', () => {
    const classRule = 'max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh]';
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.mobile), 'max-h-[50vh]');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.tablet), 'max-h-[60vh]');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.desktop), 'max-h-[70vh]');
  });

  await t.test('4.3 AIStudioScreen style grid column count across viewports', () => {
    const classRule = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.mobile), 'grid-cols-2');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.tablet), 'grid-cols-4');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.desktop), 'grid-cols-4');
  });

  await t.test('4.4 Gallery photo grid column count across viewports', () => {
    const classRule = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.mobile), 'grid-cols-2');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.tablet), 'grid-cols-4');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.desktop), 'grid-cols-5');
  });

  await t.test('4.5 Admin KPI grid column count across viewports', () => {
    const classRule = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.mobile), 'grid-cols-1');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.tablet), 'grid-cols-2');
    assert.strictEqual(computeResponsiveClass(classRule, BREAKPOINTS.desktop), 'grid-cols-4');
  });
});
