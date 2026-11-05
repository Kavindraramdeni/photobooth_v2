-- ==============================================================================
-- SnapBooth AI — Requirement R4 Safe Non-Destructive Database Migration
-- Project: hlhxbhraxtonjdieorvb (PostgreSQL 17.6)
-- 5-Hub Dashboard Architecture & Live Booth Settings Connection
-- ==============================================================================

BEGIN;

-- 1. FIX COLUMN DRIFT: Add operator_pin column to public.events
ALTER TABLE IF EXISTS public.events 
    ADD COLUMN IF NOT EXISTS operator_pin TEXT;

-- Backfill operator_pin from settings JSONB where available, fallback to 1234
UPDATE public.events 
SET operator_pin = COALESCE(settings->>'operatorPin', LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'))
WHERE operator_pin IS NULL;

-- 2. COVERING INDEXES (Resolves Supabase Advisor 0001 Warnings & Improves Query Performance)
CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON public.leads(event_id);
CREATE INDEX IF NOT EXISTS idx_leads_photo_id ON public.leads(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_templates_event_id ON public.photo_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_owner_id ON public.photos(owner_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_event_id ON public.print_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_photo_id ON public.print_jobs(photo_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- 3. RLS INITPLAN OPTIMIZATION (Resolves Supabase Advisor 0003 Warnings)
-- Wrapping auth.uid() in (SELECT auth.uid()) avoids row-by-row re-evaluation in Postgres planner.

DROP POLICY IF EXISTS "events_owner_crud" ON public.events;
CREATE POLICY "events_owner_crud"
ON public.events
FOR ALL
TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "photos_owner_select_all" ON public.photos;
CREATE POLICY "photos_owner_select_all"
ON public.photos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "photos_owner_update" ON public.photos;
CREATE POLICY "photos_owner_update"
ON public.photos
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "photos_owner_delete" ON public.photos;
CREATE POLICY "photos_owner_delete"
ON public.photos
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = photos.event_id
        AND e.owner_id = (SELECT auth.uid())
    )
);

-- 4. NON-DESTRUCTIVE SETTINGS BACKFILL FOR EXISTING EVENTS
-- Safely merges new 5-Hub default keys only if they do not already exist in settings
UPDATE public.events
SET settings = '{
    "modes": ["single", "gif", "boomerang"],
    "allowAI": true,
    "allowGIF": true,
    "allowBoomerang": true,
    "allowStrip": true,
    "allowRetakes": true,
    "retakeLimit": null,
    "beautyLevel": 0,
    "countdownSeconds": 3,
    "countdownSound": true,
    "roamingMode": false,
    "photosPerSession": 1,
    "sessionTimeout": 60,
    "displayOrientation": "auto",
    "previewHeightPercent": 60,
    "fullscreenMobile": true,
    "lockRotation": false,
    "adjustSafeArea": true,
    "operatorPin": "1234",
    "kioskMode": false,
    "allowPrint": true,
    "printCopies": 1,
    "maxPrints": null,
    "printScale": 98,
    "paperSize": "4x6",
    "autoPrint": false,
    "allowEmailShare": true,
    "allowSMSShare": false,
    "allowWhatsApp": true,
    "allowInstagram": true,
    "allowAirDrop": true,
    "shareScreenTimeout": 0,
    "leadCapture": false,
    "leadRequired": false
}'::jsonb || COALESCE(settings, '{}'::jsonb)
WHERE id IS NOT NULL;

COMMIT;
