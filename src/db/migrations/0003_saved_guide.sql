-- Migration 0003 — enrich suggested_destinations for saved AI city guides
--
-- The AI city guide produces richer items (per-city, categorised, with a
-- description and a tip) than the original columns held. These columns let us
-- persist a generated guide so revisiting a city loads from the DB instead of
-- re-querying the AI. Run once in the Supabase SQL Editor.

alter table public.suggested_destinations
  add column if not exists city        text,
  add column if not exists category    text,
  add column if not exists description text,
  add column if not exists tip         text;

-- Avoid duplicate recommendations within a trip's city+category (e.g. from
-- "more results"). NULL city/category rows (manual points) are unaffected.
create unique index if not exists suggested_destinations_trip_city_cat_name_idx
  on public.suggested_destinations (trip_id, city, category, name);
