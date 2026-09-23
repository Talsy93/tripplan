-- Migration 0026 — what the documents screen prints and nothing held
--
-- The Stitch export for the "מסמכים" tab (design/stitch/…/_3) draws a boarding
-- pass with a seat, a gate, a boarding time and a bag allowance; a hotel card
-- with stars, "breakfast included" and "paid in full"; a train with a carriage;
-- and an emergency card with the insurer's and the embassy's numbers. The owner
-- asked for the screen to be identical, and chose real fields over a picture of
-- them. This is those fields.
--
-- ## trip_bookings.details — one jsonb, not eight columns
--
-- Every key here is optional, printed on the ticket, read only together with
-- its booking and never queried across bookings: nobody asks "every booking in
-- seat 14A". That is the same argument 0023 made for `stops`, and it has the
-- same payoff — one column to add, one key to spread into a write, and a
-- database without this migration still saves every booking that does not use
-- it (see detailsInsert in booking-service.ts).
--
--   details: {
--     "seat":      "14A",     -- flight or train
--     "gate":      "B4",      -- flight
--     "boarding":  "05:40",   -- flight, HH:MM as printed — a time on the
--                             --   ticket, not an instant: it is read, not
--                             --   computed with
--     "baggage":   "23 ק״ג",  -- flight
--     "carriage":  "4",       -- train
--     "stars":     4,         -- lodging, 1–5
--     "breakfast": true,      -- lodging
--     "paid":      true       -- any kind
--   }
--
-- Validated by Zod on the way in and read through bookingDetails() on the way
-- out, as `stops` is. The one thing the database can check is that it is an
-- object.
--
-- ## trip_emergency_contacts — a table
--
-- Unlike the ticket fields these have identity: added, corrected and removed
-- one at a time, and a trip holds as many as it holds. The insurer and the
-- embassy are the two the design draws; a family doctor or the rental agency is
-- a third row, not a new column.
--
-- Idempotent. Run it in the Supabase SQL Editor. Access follows 0018: read on
-- can_view_trip, write on can_edit_trip.

alter table public.trip_bookings
  add column if not exists details jsonb;

do $$
begin
  alter table public.trip_bookings
    add constraint trip_bookings_details_is_object
    check (details is null or jsonb_typeof(details) = 'object');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.trip_emergency_contacts (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  -- Who it is: "הראל ביטוח חו״ל", "שגרירות ישראל ברומא".
  label      text not null check (length(btrim(label)) between 1 and 80),
  phone      text not null check (length(btrim(phone)) between 3 and 40),
  -- The line under the number: a policy number, an address. Optional.
  detail     text check (detail is null or length(detail) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists trip_emergency_contacts_trip_idx
  on public.trip_emergency_contacts (trip_id, created_at);

alter table public.trip_emergency_contacts enable row level security;

drop policy if exists "View emergency contacts of visible trips"
  on public.trip_emergency_contacts;
create policy "View emergency contacts of visible trips"
  on public.trip_emergency_contacts for select
  using (public.can_view_trip(trip_id));

drop policy if exists "Write emergency contacts of editable trips"
  on public.trip_emergency_contacts;
create policy "Write emergency contacts of editable trips"
  on public.trip_emergency_contacts for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));
