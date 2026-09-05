-- Migration 0022 — a booking you are holding, not counting on
--
-- ## The problem
--
-- Double-booking the same nights on purpose is normal: two hotels held over one
-- weekend while you decide, one of which will be cancelled. The app had no way
-- to say that, and so counted both of them:
--
--   * `bookedNightsByCity` **sums** overlapping stays, so a city with two held
--     hotels asked for twice the days it needs. That is what produced "the
--     cities want 52 days but your dates give 43" — a real message about a
--     number that was inflated by a booking the traveller already intends to
--     drop. domain/city-days.ts documents the summing as deliberate, and it was:
--     without this column, "you have not decided yet" was the honest answer.
--   * the cost totals added both, so the trip's price included a room nobody
--     will pay for.
--   * the "לינה כפולה" warning fired, which is correct in general and noise
--     here — the overlap is the plan, not a mistake.
--
-- ## Why not reuse `booked`
--
-- 0011's `booked` already distinguishes "reserved" from "still to reserve", and
-- this is neither. A standby booking *is* reserved — it has a confirmation
-- number and a cancellation deadline — it simply might not survive. Folding the
-- two together would lose the deadline reminders on exactly the bookings whose
-- deadlines matter most.
--
-- ## The column
--
-- Boolean, not null, default false. Unlike 0020 and 0021 this one has a
-- sensible default for every existing row — nothing held before today was on
-- standby — so backfilling is the default itself and there is no null to mean
-- "unknown".
--
-- Not constrained to lodging. Holding two flights over the same dates is the
-- same situation and the same answer, and this table has deliberately shared one
-- shape across all three kinds since 0008.
--
-- Idempotent. Run it in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists standby boolean not null default false;

-- No check constraint. The column is a boolean and `not null` already says
-- everything there is to say about its shape.

-- No RLS change, for the reason 0020 and 0021 give: the existing policies are
-- per-row on trip ownership and membership, so a new column on an existing row
-- is covered by whatever already governed that row.
