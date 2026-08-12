-- Migration 0010 — the trip planning conversation
--
-- One row per turn. Rows rather than a jsonb transcript (unlike the phrasebook
-- in 0009) because turns are appended one at a time and read in order — the
-- access pattern a table is for. A blob would mean rewriting the whole
-- conversation on every message.
--
-- Run once in the Supabase SQL Editor.

do $$ begin
  create type public.chat_role as enum ('user', 'model');
exception when duplicate_object then null; end $$;

create table if not exists public.trip_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  role       public.chat_role not null,
  content    text not null,
  created_at timestamptz not null default now()
);

-- Every read is "this trip's messages, oldest first".
create index if not exists trip_chat_messages_trip_created_idx
  on public.trip_chat_messages (trip_id, created_at);

alter table public.trip_chat_messages enable row level security;

drop policy if exists "Users manage chat of own trips" on public.trip_chat_messages;
create policy "Users manage chat of own trips"
  on public.trip_chat_messages for all
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
