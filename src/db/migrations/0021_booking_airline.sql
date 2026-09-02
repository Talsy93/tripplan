-- Migration 0021 — which airline the leg is flown by
--
-- ## Why a column and not the title
--
-- The airline has always been in `title`, as free text: "LY086 · אל על". That
-- works for reading one booking back and for nothing else. "אל על", "El Al",
-- "ELAL" and "LY" are the same carrier and would be four values, so nothing can
-- group by it, filter on it, or draw it consistently.
--
-- ## What is stored
--
-- The IATA code, uppercase — LY, TK, LH. Two characters on the ticket and on
-- the boarding pass, and the one identifier stable across the Hebrew name, the
-- English name and the flight number.
--
-- IATA and not ICAO because IATA is what is printed: LY086, not ELY086. The
-- field is transcribed from what the traveller is holding.
--
-- Nullable, and null is "not given". The app's list of carriers is curated and
-- therefore incomplete (see domain/airlines.ts), so a flight on something not
-- listed simply has no airline and keeps naming it in the title, exactly as
-- every flight did before this column existed.
--
-- Only meaningful for flight rows. Not constrained to them, for the reason 0020
-- gives about duration: the check would have to name the kinds, and this table
-- has deliberately shared one shape across all three since 0008.
--
-- Idempotent. Run it in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists airline text;

-- A shape bound, not a membership test. The set of valid codes lives in the
-- application, where it can be extended without a migration; what the database
-- guarantees is that the column holds something code-shaped rather than a
-- sentence — two or three uppercase alphanumerics, which is what IATA issues.
--
-- Three rather than two because a handful of codes are alphanumeric and IATA
-- has issued three-character codes for cargo and regional carriers; rejecting
-- them here would be the database inventing a rule the standard does not have.
--
-- Added separately so re-running the migration on a database that already has
-- the column still installs it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_bookings_airline_shape'
  ) then
    alter table public.trip_bookings
      add constraint trip_bookings_airline_shape
      check (airline is null or airline ~ '^[A-Z0-9]{2,3}$');
  end if;
end $$;

-- No RLS change, for the reason 0020 gives: the existing policies are per-row
-- on trip ownership and membership, so a new column on an existing row is
-- covered by whatever already governed that row.
