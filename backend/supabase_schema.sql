-- ==============================================================================
-- SnapBooth AI (v2.0) — Consolidated Supabase Schema & Security Setup
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Consolidated User Subscriptions (Replaces disjoint 'operators' table)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'business'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'trialing', 'past_due', 'canceled'
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 3. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    date TIMESTAMPTZ NOT NULL,
    venue TEXT DEFAULT '',
    client_name TEXT DEFAULT '',
    client_email TEXT DEFAULT '',
    branding JSONB DEFAULT '{
        "primaryColor": "#7c3aed",
        "secondaryColor": "#ffffff",
        "template": "classic",
        "footerText": "",
        "overlayText": "",
        "showDate": true
    }'::jsonb,
    settings JSONB DEFAULT '{
        "countdownSeconds": 3,
        "photosPerSession": 1,
        "allowRetakes": true,
        "allowAI": true,
        "allowGIF": true,
        "allowBoomerang": true,
        "allowPrint": true,
        "sessionTimeout": 60,
        "operatorPin": "1234"
    }'::jsonb,
    status TEXT DEFAULT 'active',
    gallery_password TEXT,
    gallery_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Photos Table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_id TEXT,
    url TEXT NOT NULL,
    thumb_url TEXT,
    storage_key TEXT,
    mode TEXT DEFAULT 'single', -- 'single', 'gif', 'boomerang', 'strip', 'burst'
    short_code TEXT UNIQUE,
    is_hidden BOOLEAN DEFAULT FALSE,
    hidden_at TIMESTAMPTZ,
    hidden_by TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL,
    email TEXT,
    phone TEXT,
    name TEXT,
    consented BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Analytics Table
CREATE TABLE IF NOT EXISTS public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'capture', 'ai_generated', 'photo_shared', 'photo_printed', 'gallery_viewed', 'lead_captured'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Event Frames Table
CREATE TABLE IF NOT EXISTS public.event_frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    storage_key TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Event Styles Table
CREATE TABLE IF NOT EXISTS public.event_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    style_key TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '✨',
    prompt TEXT NOT NULL,
    preview_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_event_style UNIQUE (event_id, style_key)
);

-- 9. Performance & Tenancy Indexes
CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON public.photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_short_code ON public.photos(short_code);
CREATE INDEX IF NOT EXISTS idx_photos_session_id ON public.photos(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON public.leads(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_id ON public.analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_action ON public.analytics(action);
