/**
 * One-time backfill script for legacy photo rows.
 *
 * Fixes rows where gallery_url points to legacy /gallery/... links
 * and/or short_code is missing.
 *
 * Usage:
 *   node scripts/backfill-photo-short-urls.js            # dry run (default)
 *   node scripts/backfill-photo-short-urls.js --apply    # writes updates
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { buildGalleryUrl, generateUniqueShortCode } = require('../src/services/sharing');

const APPLY = process.argv.includes('--apply');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function needsBackfill(photo) {
  const missingShort = !photo.short_code;
  const hasLegacyGallery = typeof photo.gallery_url === 'string' && photo.gallery_url.includes('/gallery/');
  const notUsingShortPath = typeof photo.gallery_url !== 'string' || !photo.gallery_url.includes('/p/');
  return missingShort || hasLegacyGallery || notUsingShortPath;
}

async function run() {
  console.log(`🔎 Backfill mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, event_id, short_code, gallery_url, events(slug)')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const candidates = (photos || []).filter(needsBackfill);
  console.log(`📸 Found ${photos?.length || 0} total photos, ${candidates.length} need backfill`);

  let updated = 0;
  let skipped = 0;

  for (const photo of candidates) {
    const eventSlug = photo.events?.slug;
    if (!eventSlug) {
      skipped += 1;
      console.warn(`⚠️  Skipping ${photo.id}: missing event slug`);
      continue;
    }

    const shortCode = photo.short_code || await generateUniqueShortCode(supabase);
    const galleryUrl = buildGalleryUrl(eventSlug, photo.id, shortCode);

    console.log(`→ ${photo.id}: short=${shortCode} gallery=${galleryUrl}`);

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('photos')
      .update({ short_code: shortCode, gallery_url: galleryUrl })
      .eq('id', photo.id);

    if (updateError) {
      console.error(`❌ Update failed for ${photo.id}: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`✅ Done. Updated=${updated}, Skipped=${skipped}, Mode=${APPLY ? 'APPLY' : 'DRY RUN'}`);
}

run().catch((err) => {
  console.error('❌ Backfill failed:', err.message);
  process.exit(1);
});

