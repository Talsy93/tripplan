-- 0020 — archiving a trip
--
-- The design's "עוד" menu has drawn an "ארכוב הטיול" row since the redesign, and
-- nothing behind it existed: `setTripStatus` was in the codebase with no callers,
-- and `trip_status` had three values, none of which meant "put this away".
--
-- Why a status value rather than a boolean column: ARCHITECTURE.md rule #6 says a
-- trip's *phase* is derived from its dates and is never stored, and that
-- `trips.status` is retained for explicit user intent. Archiving is the only
-- explicit user intent there is. A second `archived boolean` column would put two
-- sources of truth about the same question next to each other.
--
-- Why not 'completed': a finished trip and a put-away trip are different facts.
-- A trip you took last year is completed and you may well want it on the home
-- screen; a trip you abandoned is archived and is not completed at all. Nothing
-- writes 'completed' today — the phase calculation answers "is it over" — so
-- reusing it would have meant giving it a second, contradictory meaning.

-- `add value` cannot run inside a transaction block in Postgres versions before
-- 12, and Supabase's migration runner wraps statements. `if not exists` makes
-- this safe to re-run either way.
alter type public.trip_status add value if not exists 'archived';

-- No RLS change. Archiving is an update to a `trips` row, and the existing
-- policy already restricts that to the owner:
--
--   create policy "trips_update_own" on public.trips
--     for update using (auth.uid() = user_id);
--
-- A member with the editor role cannot archive somebody else's trip, which is
-- correct — archiving is not an edit to the trip's contents, it is a decision
-- about whether the owner still wants to see it.

-- Verification, as the owner of a trip:
--
--   update public.trips set status = 'archived' where id = '<trip>';
--   select status from public.trips where id = '<trip>';   -- 'archived'
--   update public.trips set status = 'planning' where id = '<trip>';
