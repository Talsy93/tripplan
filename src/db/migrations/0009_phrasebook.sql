-- Migration 0009 — the trip's phrasebook
--
-- One row per trip: the destination's language plus the generated phrases.
--
-- The phrases are jsonb rather than a table of their own. They are only ever
-- read as a whole — nothing filters, sorts or joins on an individual phrase —
-- so rows would buy structure nobody queries. Their shape is enforced by Zod
-- on the way in and out, which is where this project keeps its contracts.
--
-- Run once in the Supabase SQL Editor.

create table if not exists public.trip_phrasebooks (
  -- One phrasebook per trip, so the trip is the key.
  trip_id         uuid primary key references public.trips (id) on delete cascade,
  -- The destination language, in Hebrew ("יפנית") and in English ("Japanese").
  language        text not null,
  language_english text not null,
  -- Sections of phrases; see aiPhrasebookSchema for the shape.
  phrases         jsonb not null,
  created_at      timestamptz not null default now()
);

alter table public.trip_phrasebooks enable row level security;

drop policy if exists "Users manage phrasebooks of own trips" on public.trip_phrasebooks;
create policy "Users manage phrasebooks of own trips"
  on public.trip_phrasebooks for all
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
