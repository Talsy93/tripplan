-- Migration 0015 — which country a city is in, and public read-only sharing
--
-- Two unrelated features, one migration, because both are a column and neither
-- is worth a round trip to the SQL editor on its own.
--
-- ## suggested_destinations.country
--
-- The app has only ever known cities. "Group the trip by country" and "is this
-- pin plausible" both need the country, and neither can be answered from a
-- Hebrew city name alone.
--
-- It is *derived*, not entered: the coordinates already cached on each city's
-- `overview` row are reverse-geocoded through Nominatim (free, no key), which
-- turns a point into a country unambiguously — far more reliable than forward
-- geocoding a Hebrew name, which is what produced the wrong pins in the first
-- place. Cached here so it costs one lookup per city, ever.
--
-- Nullable: a city whose coordinates never resolved has no country either, and
-- the UI groups those under "יעדים נוספים" rather than refusing to render.
--
-- ## trips.share_token / shared_at
--
-- A read-only public link to a trip. The token IS the credential, so:
--
--   * It is generated with gen_random_bytes, not from the trip id — a
--     sequential or guessable token would make every trip enumerable.
--   * It is nullable and null by default. Sharing is opt-in per trip, and
--     revoking is setting it back to null, which invalidates the old link
--     permanently.
--   * It is unique, so a token identifies at most one trip.
--
-- No RLS policy is added for it on purpose. Granting anon `select ... where
-- share_token is not null` would let anyone list every shared trip in the
-- database — the token would stop being a secret. The public route reads
-- through the service-role client instead, by exact token match, and redacts
-- confirmation numbers, addresses and prices before rendering. See
-- infrastructure/share-service.ts.
--
-- Run once in the Supabase SQL Editor.

alter table public.suggested_destinations
  add column if not exists country text;

comment on column public.suggested_destinations.country is
  'Country of this city, reverse-geocoded from its cached coordinates. Only meaningful on the overview row. Null when the city never resolved.';

alter table public.trips
  add column if not exists share_token text unique,
  add column if not exists shared_at   timestamptz;

comment on column public.trips.share_token is
  'Unguessable token for the public read-only link. Null = not shared; setting it back to null revokes the link permanently.';
comment on column public.trips.shared_at is
  'When the current share_token was issued. Null when the trip is not shared.';

-- The public page looks a trip up by token and nothing else, so this is the
-- only access path that needs to be fast. Partial, because the overwhelming
-- majority of trips are never shared and do not belong in the index.
create index if not exists trips_share_token_idx
  on public.trips (share_token)
  where share_token is not null;
