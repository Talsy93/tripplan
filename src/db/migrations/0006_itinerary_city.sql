-- Migration 0006 — link itinerary items back to their city
--
-- itinerary_items was fully denormalised: it stored a title but nothing that
-- said which city the item belongs to, and saveItinerary() never wrote
-- destination_id. That made "how many nights in each destination" impossible
-- to compute, and forced the route map to order its stops by when a city was
-- added rather than by the itinerary.
--
-- The city is stored on the row rather than resolved through destination_id
-- because the AI returns entries by name, not by id. Run once in the Supabase
-- SQL Editor.

alter table public.itinerary_items
  add column if not exists city text;

-- Backfill existing itineraries by matching the stored title against the
-- guide item it came from, within the same trip.
update public.itinerary_items ii
set city = sd.city
from public.suggested_destinations sd
where sd.trip_id = ii.trip_id
  and sd.name = ii.title
  and sd.source = 'ai'
  and sd.category is not null
  and sd.city is not null
  and ii.city is null;
