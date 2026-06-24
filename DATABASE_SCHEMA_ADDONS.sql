-- SnapBooth add-on tables for lead capture, green-screen backgrounds, and print/share templates.
-- Run this in Supabase SQL editor before enabling the related backend routes.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  email text,
  phone text,
  name text,
  consented boolean not null default true,
  created_at timestamptz not null default now(),
  constraint leads_contact_required check (email is not null or phone is not null)
);

create index if not exists leads_event_id_created_at_idx on public.leads(event_id, created_at desc);

create table if not exists public.backgrounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  url text not null,
  storage_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backgrounds_event_id_idx on public.backgrounds(event_id);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  layout jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_event_id_idx on public.templates(event_id);
create unique index if not exists templates_one_default_per_event_idx on public.templates(event_id) where is_default = true;
