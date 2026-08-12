-- Migration 0008 — the trip's logistics: transport and lodging
--
-- One table rather than two. A flight, a train and a hotel share the same
-- skeleton — a title, a time range, a confirmation number, a note — and differ
-- in one respect: transport has an origin and a destination, lodging has a
-- single place. That difference costs two nullable columns; splitting it would
-- cost a second table, a second service, a second set of RLS policies and a
-- second UI, which is the kind of structure this project's YAGNI note is about.
--
-- Times are timestamptz because a flight leaves at a moment, not on a date.
-- Lodging uses the same columns for check-in and check-out, where only the date
-- part is meaningful.
--
-- Run once in the Supabase SQL Editor.

do $$ begin
  create type public.booking_kind as enum ('flight', 'train', 'lodging');
exception when duplicate_object then null; end $$;

create table if not exists public.trip_bookings (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  kind         public.booking_kind not null,
  -- Flight number, train service, or the hotel's name.
  title        text not null,
  -- Transport only. Lodging leaves both null and uses `city`.
  origin       text,
  destination  text,
  -- Which of the trip's cities this belongs to, so it can sit alongside the
  -- itinerary. Free text rather than a foreign key: the trip's cities are
  -- themselves rows in suggested_destinations, not a table of their own.
  city         text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  address      text,
  confirmation text,
  note         text,
  created_at   timestamptz not null default now()
);

-- Everything reads a trip's bookings in chronological order.
create index if not exists trip_bookings_trip_starts_idx
  on public.trip_bookings (trip_id, starts_at);

-- Row Level Security: a user reaches a booking through the trip that owns it,
-- matching the pattern migration 0002 established for the other child tables.
alter table public.trip_bookings enable row level security;

drop policy if exists "Users manage bookings of own trips" on public.trip_bookings;
create policy "Users manage bookings of own trips"
  on public.trip_bookings for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );
