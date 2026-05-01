-- ============================================================
-- VISION STUDIO — COMPLETE DATABASE SCHEMA
-- Run this entire block in Supabase SQL Editor
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- (You can keep this; it doesn't hurt)
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROVIDERS TABLE
-- ============================================================
create table if not exists public.providers (
  id          text primary key,
  name        text not null,
  base_url    text,
  logo_url    text,
  active      boolean default true,
  created_at  timestamptz default now()
);

insert into public.providers (id, name, base_url) values
  ('ikea',    'IKEA',             'https://www.ikea.com/us/en/'),
  ('ashley',  'Ashley Furniture', 'https://www.ashleyfurniture.com/'),
  ('wayfair', 'Wayfair',          'https://www.wayfair.com/'),
  ('custom',  'Custom Piece',     null)
on conflict do nothing;

-- ============================================================
-- FURNITURE CATALOG TABLE
-- ============================================================
create table if not exists public.furniture_catalog (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  name         text not null,
  provider     text references public.providers(id) default 'custom',
  provider_id  text,
  width        numeric(8,2),
  depth        numeric(8,2),
  height       numeric(8,2),
  price_usd    numeric(10,2),
  url          text,
  image_url    text,
  model_url    text,
  available    boolean default true,
  last_synced  timestamptz,
  created_at   timestamptz default now()
);

alter table public.furniture_catalog enable row level security;

drop policy if exists "public catalog read" on public.furniture_catalog;

create policy "public catalog read"
on public.furniture_catalog
for select
to anon
using (true);

-- Unique constraint for upsert in seed script
create unique index if not exists furniture_catalog_provider_provider_id_idx
  on public.furniture_catalog (provider, provider_id);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
create table if not exists public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
  name                text not null default 'My Room',
  unit                text default 'inches',
  width               numeric(8,2),
  depth               numeric(8,2),
  height              numeric(8,2) default 96,
  walls               jsonb,
  scale_px_per_inch   numeric(10,4),
  floor_plan_url      text,
  room_photo_url      text,
  detected_objects    jsonb,
  zones               jsonb,   -- user-confirmed sub-rooms: [{id,name,polygon,color,width,depth}]
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Additive migration for existing deployments
alter table public.rooms add column if not exists zones jsonb;

alter table public.rooms enable row level security;

drop policy if exists "own rooms" on public.rooms;

create policy "own rooms"
on public.rooms
for all
to public
using (auth.uid() = user_id);

-- ============================================================
-- PLACEMENTS TABLE
-- ============================================================
create table if not exists public.placements (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references public.rooms(id) on delete cascade,
  catalog_id   uuid references public.furniture_catalog(id),
  name         text,
  category     text,
  provider     text,
  provider_id  text,
  width        numeric(8,2),
  depth        numeric(8,2),
  height       numeric(8,2),
  x_inches     numeric(10,4) default 0,
  y_inches     numeric(10,4) default 0,
  rotation     integer default 0,
  color        text default '#d4a27a',
  custom       boolean default false,
  model_url    text,
  zone_id      text,   -- optional sub-room id within the parent room (see rooms.zones)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Additive migration for existing deployments
alter table public.placements add column if not exists zone_id text;

alter table public.placements enable row level security;

drop policy if exists "own placements" on public.placements;

create policy "own placements"
on public.placements
for all
to public
using (
  exists (
    select 1
    from public.rooms r
    where r.id = public.placements.room_id
      and r.user_id = auth.uid()
  )
);

-- ============================================================
-- LAYOUT EXPORTS TABLE
-- ============================================================
create table if not exists public.layout_exports (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references public.rooms(id) on delete cascade,
  layout_json  jsonb not null,
  schema_version text default '1.0',
  created_at   timestamptz default now()
);

alter table public.layout_exports enable row level security;

drop policy if exists "own exports" on public.layout_exports;

create policy "own exports"
on public.layout_exports
for all
to public
using (
  exists (
    select 1
    from public.rooms r
    where r.id = public.layout_exports.room_id
      and r.user_id = auth.uid()
  )
);

-- ============================================================
-- CHAT HISTORY TABLE
-- ============================================================
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.rooms(id) on delete cascade,
  role        text not null,
  content     text not null,
  tool_calls  jsonb,
  model_used  text,
  created_at  timestamptz default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "own chat" on public.chat_messages;

create policy "own chat"
on public.chat_messages
for all
to public
using (
  exists (
    select 1
    from public.rooms r
    where r.id = public.chat_messages.room_id
      and r.user_id = auth.uid()
  )
);

-- ============================================================
-- PROJECTS TABLE (Phase 2 alignment, additive)
-- ============================================================
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null default 'Untitled Project',
  property_type  text default 'House',
  scope          text default 'interior_exterior',
  global_vision  jsonb default '{}'::jsonb,
  status         text default 'in_progress',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.projects add column if not exists property_type text default 'House';
alter table public.projects add column if not exists scope text default 'interior_exterior';
alter table public.projects add column if not exists global_vision jsonb default '{}'::jsonb;
alter table public.projects add column if not exists status text default 'in_progress';

alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects"
on public.projects
for all
to public
using (auth.uid() = user_id);

-- ============================================================
-- SPACES TABLE (links project structure to existing rooms)
-- ============================================================
create table if not exists public.spaces (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  room_id           uuid references public.rooms(id) on delete set null,
  type              text not null default 'interior',
  name              text not null default 'Space',
  category          text,
  space_vision      jsonb default '{}'::jsonb,
  placeholder_mode  boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.spaces add column if not exists room_id uuid references public.rooms(id) on delete set null;
alter table public.spaces add column if not exists type text default 'interior';
alter table public.spaces add column if not exists name text default 'Space';
alter table public.spaces add column if not exists category text;
alter table public.spaces add column if not exists space_vision jsonb default '{}'::jsonb;
alter table public.spaces add column if not exists placeholder_mode boolean default false;

alter table public.spaces enable row level security;
drop policy if exists "own spaces" on public.spaces;
create policy "own spaces"
on public.spaces
for all
to public
using (
  exists (
    select 1
    from public.projects p
    where p.id = public.spaces.project_id
      and p.user_id = auth.uid()
  )
);