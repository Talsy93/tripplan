-- Migration 0017 — the packing list
--
-- The one thing in the app the user fills in entirely by hand.
--
-- Everything else in this schema is either derived (days per city, the phase of
-- a trip) or fetched (places from OSM, suggestions from Gemini). Gear is not:
-- what you need to pack depends on your own body, habits and medication, and no
-- model or dataset knows that. So there is deliberately no `source` column of
-- the ai/manual kind `suggested_destinations` has — every row here is the
-- user's, and a future "suggest what to pack" feature would be a different
-- thing that writes rows the user then edits, not a second class of row.
--
-- ## Why no `position`
--
-- The list is grouped by category and ordered by insertion inside each group.
-- Hand-ordering a checklist means drag-and-drop, a column to persist it and a
-- reindexing write on every move, and nobody reorders a packing list — they
-- tick it off. Insertion order is also the more useful order: the thing you
-- just remembered is the thing you were afraid of forgetting.
--
-- ## Why `category` is text and not an enum
--
-- The schema in domain/gear.ts is the authority (iron rule 3), and an enum here
-- would mean a SQL migration every time a category is added or renamed — for a
-- value that only ever groups rows in a list. The column is text with a default,
-- the write path validates against the Zod enum, and the read path falls back to
-- "other" for anything it does not recognise, so an unknown value degrades to a
-- group heading instead of an error.
--
-- Run once in the Supabase SQL Editor. Idempotent.

create table if not exists public.trip_gear (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  -- What to pack, as the user typed it. 120 is a guard against a paragraph
  -- pasted into the field, not a product limit.
  label      text not null check (length(btrim(label)) between 1 and 120),
  category   text not null default 'other',
  packed     boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.trip_gear.category is
  'Grouping key. Validated against the Zod enum in features/trips/domain/gear.ts on write; unrecognised values read back as "other".';
comment on column public.trip_gear.packed is
  'Ticked off by the user. Not derived from anything and never written by the app on its own.';

-- The list is always read for one trip, grouped and ordered in that read.
create index if not exists trip_gear_trip_id_idx
  on public.trip_gear (trip_id, category, created_at);

-- Row Level Security: reached through the owning trip, the pattern migration
-- 0002 established for every child table.
alter table public.trip_gear enable row level security;

drop policy if exists "Users manage gear of own trips" on public.trip_gear;
create policy "Users manage gear of own trips"
  on public.trip_gear for all
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
