-- Migration 0007 — remember which OpenStreetMap place a row came from
--
-- Places added from the attractions search are stored as suggested_destinations
-- rows with source='manual' (the enum value that existed from 0002 and was
-- never used until now). Unlike AI suggestions they correspond to a real
-- element in OSM, and holding onto its id is what lets the search mark a
-- result as "already in your trip" without matching on names.
--
-- Run once in the Supabase SQL Editor.

alter table public.suggested_destinations
  add column if not exists external_id text;

-- Looking up "which of these results are already added" is a per-trip query.
create index if not exists suggested_destinations_trip_external_idx
  on public.suggested_destinations (trip_id, external_id);
