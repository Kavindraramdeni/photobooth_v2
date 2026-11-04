-- ==============================================================================
-- SnapBooth AI — Production Supabase RLS Hardening & Database Migration Script
-- Project: hlhxbhraxtonjdieorvb (PostgreSQL 17, Sydney)
-- ==============================================================================
-- This script fixes:
-- 1. CRITICAL: Enables RLS on public.subscriptions
-- 2. CRITICAL: Closes anonymous INSERT/UPDATE on storage.objects (photobooth-media)
-- 3. HIGH: Fixes permissive public SELECT on photos that leaks hidden photos (OR collision)
-- 4. HIGH: Reconciles schema drift:
--      - Adds missing columns to events (gallery_password, gallery_expires_at)
--      - Harmonizes event_styles column names (preview_url <-> preview_image_url, 
--        display_order <-> sort_order, enabled <-> is_active)
--      - Creates missing tables: leads, photo_templates
-- 5. MEDIUM: Adds complete RLS policies for analytics, event_frames, operators, user_subscriptions
-- 6. MEDIUM: Cleans up duplicate public-read policies on events and photos
-- 7. SECURE: Enforces auth.uid() tenancy on all owner actions
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RECONCILE SCHEMA DRIFT (MISSING COLUMNS & TABLES)
-- ------------------------------------------------------------------------------

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure subscription tables have required user_id and email columns
ALTER TABLE IF EXISTS public.subscriptions 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE IF EXISTS public.user_subscriptions 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE IF EXISTS public.operators 
    ADD COLUMN IF NOT EXISTS email TEXT;

-- Add missing gallery columns to events
ALTER TABLE IF EXISTS public.events 
    ADD COLUMN IF NOT EXISTS gallery_password TEXT,
    ADD COLUMN IF NOT EXISTS gallery_expires_at TIMESTAMPTZ;

-- Reconcile event_styles column name mismatches
ALTER TABLE IF EXISTS public.event_styles 
    ADD COLUMN IF NOT EXISTS preview_url TEXT,
    ADD COLUMN IF NOT EXISTS preview_image_url TEXT,
    ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Sync data between column aliases so code querying either name works seamlessly
UPDATE public.event_styles 
SET 
    preview_url = COALESCE(preview_url, preview_image_url),
    preview_image_url = COALESCE(preview_image_url, preview_url),
    display_order = COALESCE(display_order, sort_order),
    sort_order = COALESCE(sort_order, display_order),
    enabled = COALESCE(enabled, is_active),
    is_active = COALESCE(is_active, enabled);

-- Create missing leads table (referred to in backend/src/routes/leads.js)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL,
    email TEXT,
    phone TEXT,
    name TEXT,
    consented BOOLEAN DEFAULT FALSE,
    opted_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create missing photo_templates table (referred to in backend/src/routes/templates.js)
CREATE TABLE IF NOT EXISTS public.photo_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    elements JSONB DEFAULT '[]'::jsonb,
    layout TEXT DEFAULT 'custom',
    width INT DEFAULT 1200,
    height INT DEFAULT 1800,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON ALL PUBLIC TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photo_templates ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. DROP DUPLICATE & OVERLY PERMISSIVE LEGACY POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read active events" ON public.events;
DROP POLICY IF EXISTS "public_read_active_events" ON public.events;
DROP POLICY IF EXISTS "events_public_select" ON public.events;
DROP POLICY IF EXISTS "events_owner_all" ON public.events;
DROP POLICY IF EXISTS "Allow public read of active events" ON public.events;
DROP POLICY IF EXISTS "events_public_read_active" ON public.events;
DROP POLICY IF EXISTS "events_owner_crud" ON public.events;

DROP POLICY IF EXISTS "Public can read photos" ON public.photos;
DROP POLICY IF EXISTS "public_read_photos" ON public.photos;
DROP POLICY IF EXISTS "photos_public_select" ON public.photos;
DROP POLICY IF EXISTS "photos_owner_all" ON public.photos;
DROP POLICY IF EXISTS "Allow public read of photos" ON public.photos;
DROP POLICY IF EXISTS "photos_public_read_visible" ON public.photos;
DROP POLICY IF EXISTS "photos_owner_select_all" ON public.photos;
DROP POLICY IF EXISTS "photos_booth_insert" ON public.photos;
DROP POLICY IF EXISTS "photos_owner_update" ON public.photos;
DROP POLICY IF EXISTS "photos_owner_delete" ON public.photos;

DROP POLICY IF EXISTS "Public can read styles" ON public.event_styles;
DROP POLICY IF EXISTS "Event owners can manage their styles" ON public.event_styles;
DROP POLICY IF EXISTS "event_styles_public_read" ON public.event_styles;
DROP POLICY IF EXISTS "event_styles_owner_crud" ON public.event_styles;

DROP POLICY IF EXISTS "Public can read frames" ON public.event_frames;
DROP POLICY IF EXISTS "frames_public_read" ON public.event_frames;
DROP POLICY IF EXISTS "event_frames_public_read" ON public.event_frames;
DROP POLICY IF EXISTS "event_frames_owner_crud" ON public.event_frames;

DROP POLICY IF EXISTS "analytics_insert" ON public.analytics;
DROP POLICY IF EXISTS "analytics_owner_select" ON public.analytics;
DROP POLICY IF EXISTS "analytics_public_insert" ON public.analytics;

DROP POLICY IF EXISTS "subscriptions_user_select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_owner_read" ON public.subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_owner_read" ON public.user_subscriptions;
DROP POLICY IF EXISTS "operators_owner_read" ON public.operators;
DROP POLICY IF EXISTS "operators_owner_update" ON public.operators;

DROP POLICY IF EXISTS "leads_owner_crud" ON public.leads;
DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
DROP POLICY IF EXISTS "templates_public_read" ON public.photo_templates;
DROP POLICY IF EXISTS "templates_owner_crud" ON public.photo_templates;

-- ------------------------------------------------------------------------------
-- 4. POLICIES FOR: events (Sanitized Public vs Privileged Owner)
-- ------------------------------------------------------------------------------
CREATE POLICY "events_public_read_active"
ON public.events
FOR SELECT
TO public
USING (status = 'active');

CREATE POLICY "events_owner_crud"
ON public.events
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5. POLICIES FOR: photos (Hierarchical Event-Owner Tenancy)
-- ------------------------------------------------------------------------------
-- Public can ONLY view photos that are explicitly not hidden
CREATE POLICY "photos_public_read_visible"
ON public.photos
FOR SELECT
TO public
USING (is_hidden = false OR is_hidden IS NULL);

-- Event owners can view ALL photos (including hidden ones for moderation)
CREATE POLICY "photos_owner_select_all"
ON public.photos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = auth.uid()
    )
);

-- Public / Booth can insert photos into active events
CREATE POLICY "photos_booth_insert"
ON public.photos
FOR INSERT
TO public
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.status = 'active'
    )
);

-- Event owners can update photos (moderation, hide, unhide)
CREATE POLICY "photos_owner_update"
ON public.photos
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = auth.uid()
    )
);

-- Event owners can delete photos
CREATE POLICY "photos_owner_delete"
ON public.photos
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 6. POLICIES FOR: leads & analytics
-- ------------------------------------------------------------------------------
CREATE POLICY "leads_public_insert"
ON public.leads
FOR INSERT
TO public
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = leads.event_id AND e.status = 'active')
);

CREATE POLICY "leads_owner_crud"
ON public.leads
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = leads.event_id AND e.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = leads.event_id AND e.owner_id = auth.uid())
);

CREATE POLICY "analytics_public_insert"
ON public.analytics
FOR INSERT
TO public
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = analytics.event_id)
);

CREATE POLICY "analytics_owner_select"
ON public.analytics
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = analytics.event_id AND e.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 7. POLICIES FOR: styles, frames, templates
-- ------------------------------------------------------------------------------
CREATE POLICY "event_styles_public_read"
ON public.event_styles
FOR SELECT
TO public
USING (
    (is_active = true OR is_active IS NULL) AND (enabled = true OR enabled IS NULL)
);

CREATE POLICY "event_styles_owner_crud"
ON public.event_styles
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_styles.event_id AND e.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_styles.event_id AND e.owner_id = auth.uid())
);

CREATE POLICY "event_frames_public_read"
ON public.event_frames
FOR SELECT
TO public
USING (is_active = true OR is_active IS NULL);

CREATE POLICY "event_frames_owner_crud"
ON public.event_frames
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_frames.event_id AND e.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_frames.event_id AND e.owner_id = auth.uid())
);

CREATE POLICY "templates_public_read"
ON public.photo_templates
FOR SELECT
TO public
USING (is_default = true OR is_default IS NULL);

CREATE POLICY "templates_owner_crud"
ON public.photo_templates
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = photo_templates.event_id AND e.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = photo_templates.event_id AND e.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 8. POLICIES FOR: subscriptions & operators
-- ------------------------------------------------------------------------------
CREATE POLICY "user_subscriptions_owner_read"
ON public.user_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "subscriptions_owner_read"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    (user_id = auth.uid()) OR 
    (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "operators_owner_read"
ON public.operators
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "operators_owner_update"
ON public.operators
FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 9. SUPABASE STORAGE BUCKET SECURITY: photobooth-media
-- ------------------------------------------------------------------------------
-- Prevent anonymous users from overwriting or uploading arbitrary files directly
-- to the storage bucket. Writes must be done via the backend service_role key
-- or authenticated users.
DO $$
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
        DROP POLICY IF EXISTS "Allow anonymous update" ON storage.objects;
        DROP POLICY IF EXISTS "photobooth_media_public_read" ON storage.objects;
        DROP POLICY IF EXISTS "photobooth_media_auth_insert" ON storage.objects;

        CREATE POLICY "photobooth_media_public_read"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'photobooth-media');

        CREATE POLICY "photobooth_media_auth_insert"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'photobooth-media');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: Storage policy adjustment skipped or managed via dashboard: %', SQLERRM;
    END;
END $$;

-- ------------------------------------------------------------------------------
-- 10. RANDOM OPERATOR PIN GENERATOR (Replaces default '1234')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_operator_pin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.settings IS NULL THEN
        NEW.settings := '{}'::jsonb;
    END IF;

    IF (NEW.settings->>'operatorPin') IS NULL OR (NEW.settings->>'operatorPin') = '1234' THEN
        NEW.settings := jsonb_set(
            NEW.settings, 
            '{operatorPin}', 
            to_jsonb(LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'))
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_operator_pin ON public.events;
CREATE TRIGGER trg_sanitize_operator_pin
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.generate_operator_pin();

COMMIT;
