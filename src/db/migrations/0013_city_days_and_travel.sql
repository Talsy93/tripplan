-- Migration 0013 — how many days each city gets, and how you get to each item
--
-- Two unrelated gaps, one migration, because both were found in the same
-- session and neither is worth a round trip to the SQL editor on its own.
--
-- 1. trip_city_days
--
-- Until now nothing in the system said how long the trip stays in each city.
-- The itinerary prompt sent a flat list of selected items and one sentence
-- asking the model to "arrange them into days", so the split between cities was
-- whatever the model happened to produce — and the days/nights the app displays
-- were read back *out* of that answer rather than being an input to it.
--
-- The honest default is the lodging: nights you have booked are the strongest
-- statement of intent that already exists, and the app already computes them
-- (lodgingByDay). This table is only the override — the row exists when the
-- user has said something different, or for a city with no booking at all. The
-- derived value is not stored, so a changed booking keeps being the source of
-- truth without a backfill.
--
-- City is free text, matching trip_bookings.city and itinerary_items.city: the
-- trip's cities are themselves rows in suggested_destinations, not a table of
-- their own.
--
-- 2. itinerary_items.travel_note / travel_minutes
--
-- The app can only compute a distance when both ends came from OSM search, so
-- for most transitions it shows the time gap and nothing else — and public
-- transport routing does not exist for free as an API (see the C4 note in
-- PROJECT_PLAN.md). These two columns let the user write down what they worked
-- out themselves, once, instead of looking it up again on the day.
--
-- Run once in the Supabase SQL Editor.

-- 1. Per-city day override ----------------------------------------------------
create table if not exists public.trip_city_days (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  city       text not null,
  -- A trip day, not a night. 60 is a guard against a typo, not a product limit.
  days       int  not null check (days between 1 and 60),
  updated_at timestamptz not null default now(),
  -- One override per city per trip, and the natural key is the whole row.
  primary key (trip_id, city)
);

-- Row Level Security: a user reaches an override through the trip that owns it,
-- matching the pattern migration 0002 established for the other child tables.
alter table public.trip_city_days enable row level security;

drop policy if exists "Users manage city days of own trips" on public.trip_city_days;
create policy "Users manage city days of own trips"
  on public.trip_city_days for all
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

-- 2. Travel detail per itinerary item ----------------------------------------
alter table public.itinerary_items
  add column if not exists travel_note    text,
  add column if not exists travel_minutes int;

-- A negative or absurd duration is a typo. Added as a named constraint so it
-- can be dropped if the shape ever changes.
do $$ begin
  alter table public.itinerary_items
    add constraint itinerary_items_travel_minutes_sane
    check (travel_minutes is null or travel_minutes between 0 and 1440);
exception when duplicate_object then null; end $$;
