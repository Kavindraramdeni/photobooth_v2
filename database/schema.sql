-- SnapBooth AI - Supabase Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- ─── EVENTS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  venue TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PHOTOS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT,
  url TEXT NOT NULL,
  thumb_url TEXT,
  gallery_url TEXT,
  storage_key TEXT,
  mode TEXT DEFAULT 'single' CHECK (mode IN ('single', 'strip', 'gif', 'boomerang', 'ai', 'filtered')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ANALYTICS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_mode ON photos(mode);
CREATE INDEX IF NOT EXISTS idx_analytics_event_id ON analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_action ON analytics(action);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Enable RLS (backend uses service key so it bypasses RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to photos (for gallery pages)
CREATE POLICY "Public can view photos" ON photos
  FOR SELECT USING (true);

-- Allow public read access to events (for booth loading)
CREATE POLICY "Public can view events" ON events
  FOR SELECT USING (status = 'active');

-- Backend service key handles all writes (bypasses RLS)

-- ─── SAMPLE EVENT ─────────────────────────────────────────────────────────
-- Insert a demo event to test with
INSERT INTO events (name, slug, date, venue, branding, settings, status)
VALUES (
  'Demo Event',
  'demo',
  CURRENT_DATE,
  'Test Venue',
  '{
    "eventName": "Demo Booth",
    "primaryColor": "#7c3aed",
    "secondaryColor": "#ffffff",
    "footerText": "Demo Event · SnapBooth AI",
    "overlayText": "",
    "showDate": true,
    "template": "classic"
  }',
  '{
    "countdownSeconds": 3,
    "photosPerSession": 1,
    "allowRetakes": true,
    "allowAI": true,
    "allowGIF": true,
    "allowBoomerang": true,
    "allowPrint": true,
    "printCopies": 1,
    "sessionTimeout": 60,
    "operatorPin": "1234"
  }',
  'active'
)
ON CONFLICT (slug) DO NOTHING;
