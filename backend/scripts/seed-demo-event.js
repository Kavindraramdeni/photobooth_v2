/**
 * seed-demo-event.js
 * Run once on Render or locally to create the public demo event in Supabase.
 *
 * Usage:
 *   node scripts/seed-demo-event.js
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DEMO_EVENT = {
  name: 'SnapBooth Live Demo',
  slug: 'snapbooth-demo',
  date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
  location: 'Live Demo',
  status: 'active',
  branding: {
    primaryColor: '#7c3aed',
    eventName: 'SnapBooth Demo',
    logo: null,
    overlayText: '✨ Powered by SnapBooth AI',
  },
  settings: {
    operatorPin: '',          // No PIN — anyone can access
    allowAI: true,
    allowGIF: true,
    allowBoomerang: true,
    allowStrip: true,
    allowPrint: false,
    allowRetakes: true,
    leadCapture: false,       // No gate — pure demo experience
    autoGallery: true,
    modes: ['single', 'gif', 'boomerang'],
    countdownSeconds: 3,
    maxPhotosPerSession: 999,
  },
};

async function main() {
  console.log('🌱 Seeding demo event...');

  // Check if already exists
  const { data: existing } = await supabase
    .from('events')
    .select('id, slug')
    .eq('slug', 'snapbooth-demo')
    .single();

  if (existing) {
    console.log(`✅ Demo event already exists (id: ${existing.id}) — updating settings...`);
    const { error } = await supabase
      .from('events')
      .update({ branding: DEMO_EVENT.branding, settings: DEMO_EVENT.settings, status: 'active' })
      .eq('id', existing.id);
    if (error) throw error;
    console.log('✅ Demo event updated.');
    return;
  }

  const { data, error } = await supabase
    .from('events')
    .insert(DEMO_EVENT)
    .select()
    .single();

  if (error) throw error;
  console.log(`✅ Demo event created! id: ${data.id}, slug: ${data.slug}`);
  console.log(`🔗 Demo URL: ${process.env.FRONTEND_URL || 'https://photobooth-v2-xi.vercel.app'}/booth?event=snapbooth-demo`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
