-- ============================================================
-- VISION STUDIO — COMPLETE DATABASE SCHEMA
-- Run this entire block in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROVIDERS TABLE
-- ============================================================
create table if not exists providers (
  id          text primary key,
  name        text not null,
  base_url    text,
  logo_url    text,
  active      boolean default true,
  created_at  timestamptz default now()
);

insert into providers (id, name, base_url) values
  ('ikea',    'IKEA',             'https://www.ikea.com/us/en/'),
  ('ashley',  'Ashley Furniture', 'https://www.ashleyfurniture.com/'),
  ('wayfair', 'Wayfair',          'https://www.wayfair.com/'),
  ('custom',  'Custom Piece',     null)
on conflict do nothing;

-- ============================================================
-- FURNITURE CATALOG TABLE
-- ============================================================
create table if not exists furniture_catalog (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  name         text not null,
  provider     text references providers(id) default 'custom',
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

alter table furniture_catalog enable row level security;
create policy "public catalog read" on furniture_catalog for select using (true);

-- Unique constraint for upsert in seed script
create unique index if not exists furniture_catalog_provider_provider_id_idx
  on furniture_catalog (provider, provider_id);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
create table if not exists rooms (
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
alter table rooms add column if not exists zones jsonb;

alter table rooms enable row level security;
create policy "own rooms" on rooms for all using (auth.uid() = user_id);

-- ============================================================
-- PLACEMENTS TABLE
-- ============================================================
create table if not exists placements (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) on delete cascade,
  catalog_id   uuid references furniture_catalog(id),
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
alter table placements add column if not exists zone_id text;

alter table placements enable row level security;
create policy "own placements" on placements for all
  using (exists (
    select 1 from rooms r where r.id = placements.room_id and r.user_id = auth.uid()
  ));

-- ============================================================
-- LAYOUT EXPORTS TABLE
-- ============================================================
create table if not exists layout_exports (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) on delete cascade,
  layout_json  jsonb not null,
  schema_version text default '1.0',
  created_at   timestamptz default now()
);

alter table layout_exports enable row level security;
create policy "own exports" on layout_exports for all
  using (exists (
    select 1 from rooms r where r.id = layout_exports.room_id and r.user_id = auth.uid()
  ));

-- ============================================================
-- CHAT HISTORY TABLE
-- ============================================================
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  role        text not null,
  content     text not null,
  tool_calls  jsonb,
  model_used  text,
  created_at  timestamptz default now()
);

alter table chat_messages enable row level security;
create policy "own chat" on chat_messages for all
  using (exists (
    select 1 from rooms r where r.id = chat_messages.room_id and r.user_id = auth.uid()
  ));
