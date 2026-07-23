-- Migration 0004 — itinerary scheduling columns
--
-- The AI-built itinerary organises the trip's selected items into days with
-- time-of-day labels (trips may have no calendar dates). These columns hold
-- that structure on itinerary_items. Run once in the Supabase SQL Editor.

alter table public.itinerary_items
  add column if not exists day_number  int,
  add column if not exists title       text,
  add column if not exists start_label text,
  add column if not exists end_label   text,
  add column if not exists note        text;
