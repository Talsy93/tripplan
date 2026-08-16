-- Migration 0012 — the devices a user wants reminders on
--
-- A Web Push subscription is what a browser hands back once the user allows
-- notifications: an endpoint URL belonging to the browser vendor's push service,
-- plus two keys used to encrypt the payload so that service cannot read it.
--
-- One row per device, not per user: the same person legitimately has a phone and
-- a laptop, and a reminder should reach whichever they are near.
--
-- `endpoint` is the natural key — the browser reissues the same one for the same
-- device+site, so re-subscribing must update rather than accumulate. Unique
-- rather than a primary key so the row keeps a stable id of its own.
--
-- Run once in the Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  -- The subscription's public key and auth secret, straight from the browser.
  p256dh     text not null,
  auth       text not null,
  -- Free text from the browser, kept only to help the user recognise a device
  -- in a list. Never parsed or trusted.
  user_agent text,
  created_at timestamptz not null default now()
);

-- The nightly job asks "who should this reminder go to", which is a lookup by
-- user.
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- Row Level Security: a user only ever sees and manages their own devices.
--
-- NOTE: the reminder job reads across all users and therefore cannot use this
-- path — it connects with the service role key, which bypasses RLS by design.
-- That key is server-only and must never be exposed to the browser.
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
