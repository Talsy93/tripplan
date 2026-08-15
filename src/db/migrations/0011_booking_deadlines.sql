-- Migration 0011 — the deadlines attached to a booking
--
-- Two things a traveller has to do *before* a trip, which the table could not
-- record until now:
--
--   1. Cancel one of two hotels booked for the same nights. Holding two rooms
--      while deciding is normal; forgetting to release one is what costs money.
--      `free_cancellation_until` is the moment that stops being free.
--
--   2. Book something that has to be reserved well in advance — a Japanese
--      train a month out. `book_by` is the deadline, and `booked` is false until
--      it actually exists as a reservation.
--
-- Three columns on trip_bookings rather than new tables, for the same reason
-- 0008 put flights, trains and lodging in one: these are attributes of a
-- booking, not new entities. A to-book row is a booking that has a deadline
-- instead of a confirmation number.
--
-- These two are `date`, NOT timestamptz like starts_at/ends_at — the one place
-- this migration deliberately departs from 0008's pattern.
--
-- A cancellation deadline is a calendar date ("free until the 10th"), not an
-- instant. Storing it as timestamptz forces a time to be invented, and there is
-- no safe one: real offsets run from UTC-12 to UTC+14, a 26-hour spread, so for
-- any chosen time-of-day some timezone reads it as a different day. Midnight
-- breaks west of UTC; noon breaks at UTC+13/+14 (Kiritimati, Samoa, Tonga).
-- A `date` has no timezone to get wrong.
--
-- `booked` defaults to true so every existing row keeps its current meaning:
-- everything already in the table is something that was actually booked.
--
-- Run once in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists free_cancellation_until date,
  add column if not exists book_by                 date,
  add column if not exists booked                  boolean not null default true,
  -- How many days before a deadline to start reminding. Null means "use the
  -- app's default", so an existing row needs no backfill and a user who does not
  -- care never has to choose. Bounded because a reminder 400 days early is not a
  -- reminder, and a negative one is not a thing.
  add column if not exists reminder_days_before    integer
    check (reminder_days_before is null
           or (reminder_days_before >= 0 and reminder_days_before <= 60));

-- Finding "what has a deadline coming up" is a per-trip scan of a few rows, so
-- no index is added: trip_bookings_trip_starts_idx from 0008 already narrows to
-- the trip, and a trip holds a handful of bookings, not thousands.

comment on column public.trip_bookings.free_cancellation_until is
  'Deadline for cancelling without charge. Null when unknown or non-refundable.';
comment on column public.trip_bookings.book_by is
  'Deadline for making this reservation. Only meaningful while booked = false.';
comment on column public.trip_bookings.booked is
  'False for something still to be reserved; true for a real reservation.';
comment on column public.trip_bookings.reminder_days_before is
  'Days before a deadline to begin reminding. Null = the app default.';
