-- Migration 0027 — a schedule entry's own position on the map
--
-- Asked for as: "some destinations have no location on the map. Find it with a
-- search for that specific place, and when that fails let me type an address
-- for it so it shows on the map."
--
-- An entry already gets a position when it was built from a saved place that
-- has one (itinerary-service matches city + name against
-- suggested_destinations), and locating a place writes the position there, on
-- the saved place, so every screen that shows it gets the pin. These columns
-- are for the rest: an entry typed straight into the schedule, or one the
-- builder added that matches no saved place. Nothing else can hold a position
-- for it.
--
-- Nullable and without a default: "no position" is the honest state of every
-- existing row. Read in its own tier by getItinerary, so a database without
-- this migration keeps drawing the schedule and only the manual pins wait.
--
-- Run once in the Supabase SQL Editor. Idempotent. The table's existing RLS
-- (0018: can_edit_trip) already covers the new columns.

alter table public.itinerary_items
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
