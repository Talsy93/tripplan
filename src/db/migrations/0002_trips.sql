-- Migration 0002 — trips, suggested_destinations, itinerary_items
--
-- The core trip domain. A trip is a state machine (planning → executing →
-- completed). Dates are optional so a trip can start as a draft. Run once in
-- the Supabase SQL Editor.

-- 1. Enums --------------------------------------------------------------------
do $$ begin
  create type public.trip_status as enum ('planning', 'executing', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.destination_source as enum ('ai', 'manual');
exception when duplicate_object then null; end $$;

-- 2. trips --------------------------------------------------------------------
create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  start_date date,
  end_date   date,
  status     public.trip_status not null default 'planning',
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);

-- 3. suggested_destinations ---------------------------------------------------
create table if not exists public.suggested_destinations (
  id                         uuid primary key default gen_random_uuid(),
  trip_id                    uuid not null references public.trips (id) on delete cascade,
  name                       text not null,
  latitude                   double precision,
  longitude                  double precision,
  estimated_duration_minutes integer,
  source                     public.destination_source not null default 'manual',
  selected                   boolean not null default false,
  created_at                 timestamptz not null default now()
);

create index if not exists suggested_destinations_trip_id_idx
  on public.suggested_destinations (trip_id);

-- 4. itinerary_items ----------------------------------------------------------
create table if not exists public.itinerary_items (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  destination_id uuid references public.suggested_destinations (id) on delete cascade,
  start_time     timestamptz,
  end_time       timestamptz,
  position       integer not null,
  created_at     timestamptz not null default now()
);

create index if not exists itinerary_items_trip_id_idx
  on public.itinerary_items (trip_id);

-- 5. Row Level Security -------------------------------------------------------
-- A user reaches a trip when they own it, and reaches its destinations /
-- itinerary items through that trip.
alter table public.trips enable row level security;
alter table public.suggested_destinations enable row level security;
alter table public.itinerary_items enable row level security;

drop policy if exists "Users manage own trips" on public.trips;
create policy "Users manage own trips"
  on public.trips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage destinations of own trips"
  on public.suggested_destinations;
create policy "Users manage destinations of own trips"
  on public.suggested_destinations for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage itinerary of own trips"
  on public.itinerary_items;
create policy "Users manage itinerary of own trips"
  on public.itinerary_items for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );
