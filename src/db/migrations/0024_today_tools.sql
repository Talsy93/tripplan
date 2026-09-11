-- Migration 0024 — the tools of the "היום" tab
--
-- Four small things the day screen asked for once people used it on a trip:
--
--   1. trip_expenses    — what was spent today, typed in by hand. Bookings carry
--                         their own cost; this is everything else (lunch, a
--                         ticket bought at the door, a taxi).
--   2. trip_reminders   — "at 17:30 on day 3, call the hotel". Shown inside the
--                         day's timeline at its hour, ticked off like a task.
--   3. trip_prep_items  — the to-do list before departure: check-in, passport,
--                         insurance… with an optional link to the ticket or
--                         document it is about.
--   4. itinerary_items.fixed — a booked table or a timed ticket. When the day
--                         is re-timed around an early or late arrival, fixed
--                         items keep their hour and everything else moves.
--
-- Run once in the Supabase SQL Editor. Idempotent. Access follows 0018: read on
-- can_view_trip, write on can_edit_trip.

-- 1. daily expenses ------------------------------------------------------------
create table if not exists public.trip_expenses (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 60),
  amount     numeric(12, 2) not null check (amount > 0),
  -- ISO 4217, validated in domain/expenses.ts on write.
  currency   text not null check (length(currency) = 3),
  note       text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists trip_expenses_trip_day_idx
  on public.trip_expenses (trip_id, day_number, created_at);

alter table public.trip_expenses enable row level security;

drop policy if exists "View expenses of visible trips" on public.trip_expenses;
create policy "View expenses of visible trips"
  on public.trip_expenses for select
  using (public.can_view_trip(trip_id));

drop policy if exists "Write expenses of editable trips" on public.trip_expenses;
create policy "Write expenses of editable trips"
  on public.trip_expenses for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- 2. reminders -----------------------------------------------------------------
create table if not exists public.trip_reminders (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 60),
  -- Wall-clock "HH:MM" in the trip's zone, the same shape itinerary_items uses
  -- for start_label, so the two sort together in one timeline.
  time_label text not null check (time_label ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title      text not null check (length(btrim(title)) between 1 and 120),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists trip_reminders_trip_day_idx
  on public.trip_reminders (trip_id, day_number, time_label);

alter table public.trip_reminders enable row level security;

drop policy if exists "View reminders of visible trips" on public.trip_reminders;
create policy "View reminders of visible trips"
  on public.trip_reminders for select
  using (public.can_view_trip(trip_id));

drop policy if exists "Write reminders of editable trips" on public.trip_reminders;
create policy "Write reminders of editable trips"
  on public.trip_reminders for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- 3. preparation checklist ----------------------------------------------------------
create table if not exists public.trip_prep_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  title      text not null check (length(btrim(title)) between 1 and 160),
  done       boolean not null default false,
  -- When it has to be done by (online check-in opens 24h before the flight).
  due_date   date,
  -- A link to the thing this item is about — the e-ticket, the insurance PDF,
  -- the hotel confirmation. A URL, not a file: the app has no file storage.
  url        text check (url is null or length(url) <= 2000),
  -- Which suggestion this came from ("checkin", "passport"…), so the same
  -- suggestion is not offered twice. Null for items typed in by hand.
  kind       text check (kind is null or length(kind) <= 40),
  created_at timestamptz not null default now()
);

create index if not exists trip_prep_items_trip_idx
  on public.trip_prep_items (trip_id, created_at);

alter table public.trip_prep_items enable row level security;

drop policy if exists "View prep of visible trips" on public.trip_prep_items;
create policy "View prep of visible trips"
  on public.trip_prep_items for select
  using (public.can_view_trip(trip_id));

drop policy if exists "Write prep of editable trips" on public.trip_prep_items;
create policy "Write prep of editable trips"
  on public.trip_prep_items for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- 4. anchored itinerary items -----------------------------------------------------
alter table public.itinerary_items
  add column if not exists fixed boolean not null default false;

comment on column public.itinerary_items.fixed is
  'A booked table or timed ticket. Kept at its hour when the day is re-timed around an arrival; everything else shifts.';

-- Record that this ran (0016 introduced the ledger).
insert into public.applied_migrations (name)
values ('0024_today_tools')
on conflict do nothing;
