-- Migration 0025 — a mark on a day, independent of its schedule
--
-- Asked for as: "when building the schedule I want to add a point to mark on
-- that day regardless of the schedule — say that a certain day is a holiday."
--
-- Everything the day screen holds today is an *event*: an itinerary item has an
-- hour, a reminder has an hour, a booking has a timestamp. None of them can say
-- something true of the whole day and of no particular minute in it. A holiday,
-- a rest day, someone's birthday, "the museums are shut on Mondays" — these
-- change what the day should hold without themselves being something in it.
--
-- Which is also why this is not a reminder with a fake time. A reminder at
-- 00:00 would sort into the timeline as the first thing that happens, and the
-- itinerary builder would read it as an item to plan around rather than as a
-- fact about the day.
--
-- A day may hold more than one — a holiday that is also a birthday is two
-- statements, not one — so there is no unique constraint on (trip_id,
-- day_number). Same call trip_reminders makes.
--
-- Run once in the Supabase SQL Editor. Idempotent. Access follows 0018: read on
-- can_view_trip, write on can_edit_trip.

create table if not exists public.trip_day_notes (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 60),
  -- Validated against the same list in domain/day-notes.ts. Kept as text with a
  -- check rather than a postgres enum, matching booking kind: an enum needs a
  -- migration to grow, and this list will grow.
  kind       text not null check (kind in ('holiday', 'rest', 'event', 'note')),
  label      text not null check (length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists trip_day_notes_trip_day_idx
  on public.trip_day_notes (trip_id, day_number, created_at);

alter table public.trip_day_notes enable row level security;

drop policy if exists "View day notes of visible trips" on public.trip_day_notes;
create policy "View day notes of visible trips"
  on public.trip_day_notes for select
  using (public.can_view_trip(trip_id));

drop policy if exists "Write day notes of editable trips" on public.trip_day_notes;
create policy "Write day notes of editable trips"
  on public.trip_day_notes for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));
