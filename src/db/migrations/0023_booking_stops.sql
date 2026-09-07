-- Migration 0023 — a flight with a stop is one ticket, not two rows
--
-- ## The problem
--
-- A journey with a connection had to be entered as two bookings: TLV→DXB and
-- DXB→NRT, two cards, two confirmation codes for one code, two prices for one
-- price. 0019's `findConnections` then guessed the pair back together by
-- adjacency — the next leg departing where the last one landed, within twelve
-- hours — and stamped a "קונקשן" badge on both cards.
--
-- The guess is decent and the result was reported as noise: "why is there a
-- connection badge on every flight card". It is on every card because every
-- card is half a journey. Nothing was wrong with the detection; the shape
-- underneath it was wrong.
--
-- ## The shape
--
-- One booking is one ticket, end to end, exactly as it already was: `origin` is
-- where you leave, `destination` is where you arrive, `starts_at` is the first
-- departure, `ends_at` is the last arrival, `duration_minutes` is the whole
-- journey. **Nothing about those changes.** That is the point of doing it this
-- way: every reader in the app — bookingsByDay, the itinerary, the route
-- sketch, the city day counts, the cost totals — keeps working untouched,
-- because none of them ever needed the middle.
--
-- This column adds only what is genuinely new: where you touch down on the way.
--
--   stops: [
--     {
--       "place":      "דובאי",              -- required
--       "arrives_at": "2026-09-11T04:20:00Z", -- when you land there, or null
--       "departs_at": "2026-09-11T07:05:00Z", -- when you leave again, or null
--       "flight":     "EK932",              -- the flight *out* of this stop
--       "airline":    "EK"                  -- its carrier, for the code tile
--     }
--   ]
--
-- The flight number on a stop is the leg leaving it, not the one arriving: the
-- arriving leg's number is already on the booking itself (`title`), so leg 1
-- reads its flight from the booking and every later leg from the stop it starts
-- at. No field is stored twice, and the legs are derived rather than kept —
-- see flightSegments() in domain/booking.ts.
--
-- ## Why jsonb and not a `trip_booking_stops` table
--
-- A stop has no identity of its own. Nothing links to it, nothing queries
-- across stops, nothing sorts by them; they are read only as an ordered list
-- belonging to exactly one booking, and always at the same time as it. A child
-- table would buy a join, a second RLS policy and a second delete path in
-- exchange for none of that. jsonb keeps the ordering (an array is ordered) and
-- keeps the stops arriving with their booking in the single select
-- listBookings already does.
--
-- The trade is that Postgres cannot validate the element shape, so the array is
-- parsed with Zod on the way in and read through bookingStops() on the way out.
-- That is the same contract every other column here has — the check constraints
-- in 0020 and 0021 mirror Zod rather than replace it.
--
-- ## The column
--
-- Nullable with no default. Null and `[]` both mean "no stops" and
-- bookingStops() reads them alike, so there is nothing to backfill: every
-- existing booking is a direct one, which is what null already says.
--
-- Not constrained to flights. A train with a change of platform is the same
-- fact, and this table has deliberately shared one shape across its kinds since
-- 0008. The form asks for stops on any transport kind and never on lodging.
--
-- Idempotent. Run it in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists stops jsonb;

-- One constraint, and only the one the database can actually enforce: this has
-- to be a JSON *array* if it is anything. A row where `stops` is an object or a
-- string is not a shape the app can recover from, and unlike the element fields
-- it costs nothing to rule out here.
do $$
begin
  alter table public.trip_bookings
    add constraint trip_bookings_stops_is_array
    check (stops is null or jsonb_typeof(stops) = 'array');
exception
  when duplicate_object then null;
end $$;

-- No RLS change, for the reason 0020, 0021 and 0022 give: the existing policies
-- are per-row on trip ownership and membership, so a new column on an existing
-- row is covered by whatever already governed that row.
