-- Migration 0020 — the duration printed on a transport ticket
--
-- ## Why this cannot be computed
--
-- `starts_at` and `ends_at` are both instants, and both are written by reading
-- the user's typed wall clock in APP_TIME_ZONE (see src/lib/datetime.ts and the
-- long note in 0016). A ticket, though, prints the *local* time at each end:
-- TLV→NRT departs 22:20 Israel time and arrives 16:30 Tokyo time.
--
-- The app stores both of those as Israel wall clock, which is right for
-- displaying them — the arrival board at Narita says 16:30 and so does the app —
-- and useless for arithmetic. `ends_at - starts_at` on that flight is 18h10m.
-- The real duration is about 11 hours. The difference is the six-hour offset
-- between the two zones, and nothing in the row records it.
--
-- Fixing that properly means storing a zone or an offset per endpoint, which
-- means an airport-to-timezone table the app does not have and cannot derive
-- from a free-text "NRT". So the duration is asked for instead: it is printed on
-- the ticket the user is already copying from.
--
-- ## The column
--
-- Minutes, nullable. Null is "not given" and the leg simply shows no duration —
-- never a computed guess, because a wrong duration is worse than no duration.
--
-- Only meaningful for flight and train rows. Not constrained to them: the
-- check would have to name the kinds, and this table has deliberately shared one
-- shape across all three since 0008.
--
-- Idempotent. Run it in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists duration_minutes integer;

-- A sanity bound rather than a business rule: 0 is not a journey and anything
-- over a fortnight is a typo, not a flight. Added separately so re-running the
-- migration on a database that already has the column still installs it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_bookings_duration_minutes_sane'
  ) then
    alter table public.trip_bookings
      add constraint trip_bookings_duration_minutes_sane
      check (duration_minutes is null
             or (duration_minutes > 0 and duration_minutes <= 20160));
  end if;
end $$;

-- No RLS change. The existing policies are per-row on trip ownership and
-- membership, so a new column on an existing row is covered by whatever already
-- governed that row.
