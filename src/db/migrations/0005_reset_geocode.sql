-- Migration 0005 — clear cached city coordinates
--
-- The first version of the route map geocoded Hebrew city names through
-- Nominatim with no country context, which mis-resolved them (e.g. "האקונה"
-- landed in the US) and cached the wrong point. Geocoding now goes through
-- Wikipedia first, with the trip name as context.
--
-- Clearing the cache makes every city re-resolve through the fixed lookup.
-- Nothing else writes these columns, so this loses no user data.
-- Run once in the Supabase SQL Editor.

update public.suggested_destinations
set latitude = null,
    longitude = null
where latitude is not null
   or longitude is not null;
