-- Migration 0018 — a trip can have more than one person
--
-- Until now "your trips" and "trips you can reach" were the same sentence:
-- every policy in the schema said `trips.user_id = auth.uid()`, so a trip had
-- exactly one person and the only way to show it to anyone else was the
-- anonymous read-only link from 0015. This adds the missing middle: a named
-- person, on their own device, with their own login, who can edit.
--
-- ## Three access levels now exist, and they are deliberately different things
--
--   1. `share_token` (0015) — anonymous, read-only, redacted. Whoever holds the
--      URL. No account, no identity, no confirmation numbers, no addresses, no
--      prices. Unchanged by this migration.
--   2. `trip_members.role = 'viewer'` — a named account that can read the
--      trip in full, through the app, like the owner sees it.
--   3. `trip_members.role = 'editor'` — the same, and can write.
--
-- Levels 2 and 3 see the un-redacted trip. That is the intended difference and
-- not an oversight: redaction exists because a link can be forwarded to anyone,
-- and this is the opposite case — the owner named a specific account. A partner
-- travelling with you needs the hotel address and the booking reference; that is
-- most of the reason to give them access at all.
--
-- Deleting a trip stays the owner's alone. An editor can change everything
-- inside a trip and cannot destroy the trip itself.
--
-- ## Why SECURITY DEFINER functions and not inline EXISTS clauses
--
-- The existing child-table policies inline `exists (select 1 from trips ...)`,
-- which works only because the caller can already see their own trip row.
-- Membership breaks that: a policy on `trips` has to consult `trip_members`, and
-- any policy on `trip_members` has to consult `trips` to let an owner manage the
-- list — and Postgres evaluates the second table's RLS while evaluating the
-- first, which is infinite recursion. It surfaces as
-- `infinite recursion detected in policy for relation "trips"` at query time,
-- not at migration time, so it would have shipped.
--
-- A SECURITY DEFINER function runs as its owner and therefore does not re-enter
-- RLS, which cuts the cycle. All three helpers below are that, and every policy
-- in the schema is rewritten to go through them. They are the only place the
-- access rule is written down, so changing who can see a trip is one edit here
-- rather than eight.
--
-- `set search_path = public, pg_temp` on each: without it a SECURITY DEFINER
-- function resolves unqualified names against the *caller's* search_path, which
-- is how a caller can shadow `trips` with their own table and make the function
-- answer about that instead.
--
-- ## Invitations
--
-- An invite is a row addressed to an email, plus an unguessable token that goes
-- in a URL. Accepting is a SECURITY DEFINER function, so the invitee never needs
-- read access to the invites table — they need to be able to redeem exactly one
-- token and nothing else.
--
-- Acceptance requires the logged-in account's email to match the invited email.
-- A forwarded invite link is therefore useless to whoever it was forwarded to,
-- which is the property that makes this "give access to a person" rather than
-- "another link that grants access".
--
-- There is deliberately no phone column. Supabase phone auth needs a paid SMS
-- provider (Twilio, MessageBird, Vonage), and this project does not use paid
-- services — see the decision log. A phone number is a *delivery channel* in the
-- UI, which hands the link to the owner's own WhatsApp or SMS app; the identity
-- that redeems it is still an email account.
--
-- Run once in the Supabase SQL Editor. Idempotent.

-- 1. Roles --------------------------------------------------------------------
do $$ begin
  create type public.trip_role as enum ('viewer', 'editor');
exception when duplicate_object then null; end $$;

-- 2. Membership ---------------------------------------------------------------
create table if not exists public.trip_members (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.trip_role not null default 'viewer',
  created_at timestamptz not null default now(),
  -- One row per person per trip. Re-inviting somebody changes their role
  -- instead of granting them a second, contradictory one.
  primary key (trip_id, user_id)
);

comment on table public.trip_members is
  'Who besides the owner can reach a trip. The owner is NOT a row here — ownership stays trips.user_id, so a trip cannot lose its owner by a delete on this table.';

create index if not exists trip_members_user_id_idx
  on public.trip_members (user_id);

-- 3. Invitations --------------------------------------------------------------
create table if not exists public.trip_invites (
  -- The token IS the URL, so it is the primary key: one row per link, and
  -- looking an invite up is a primary-key hit.
  token       text primary key check (token ~ '^[0-9a-f]{32}$'),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  -- Stored lowercased by the app; compared case-insensitively on acceptance
  -- regardless, because email local-part casing is not something to bet on.
  email       text not null check (position('@' in email) > 1),
  role        public.trip_role not null default 'viewer',
  invited_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

comment on column public.trip_invites.token is
  'Unguessable 32-hex token, generated with the platform CSPRNG (domain/share.ts). Single-use: accepted_at is set on redemption and a used token stops resolving.';

-- One *open* invite per email per trip. A partial unique index rather than a
-- constraint on the whole table, so the same person can be re-invited after an
-- invite was accepted and their membership later removed.
create unique index if not exists trip_invites_open_unique
  on public.trip_invites (trip_id, lower(email))
  where accepted_at is null;

create index if not exists trip_invites_trip_id_idx
  on public.trip_invites (trip_id);

-- 4. Access helpers -----------------------------------------------------------
-- See the header for why these are SECURITY DEFINER. All three are STABLE: they
-- read no state that can change inside a statement, which lets the planner call
-- them once per query rather than once per row.

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_trip(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and m.role = 'editor'
  );
$$;

-- anon is not granted execute: every one of these answers a question about
-- auth.uid(), which is null for anon, so the only possible answer is false. The
-- public share page reads through the service-role client instead (0015).
revoke all on function public.is_trip_owner(uuid) from public, anon;
revoke all on function public.can_view_trip(uuid) from public, anon;
revoke all on function public.can_edit_trip(uuid) from public, anon;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.can_view_trip(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;

-- 5. Rewrite every trip-scoped policy ----------------------------------------
-- The old policies were all `for all` with one ownership test. They are split
-- into read and write here, because that split is the entire point of a viewer.

-- trips ----------------------------------------------------------------------
-- Note what is NOT symmetric: insert is bounded to yourself (you cannot create
-- a trip owned by someone else), update allows an editor, and delete stays with
-- the owner.
drop policy if exists "Users manage own trips" on public.trips;
drop policy if exists "View trips you own or are a member of" on public.trips;
drop policy if exists "Create your own trips" on public.trips;
drop policy if exists "Edit trips you own or can edit" on public.trips;
drop policy if exists "Only the owner deletes a trip" on public.trips;

create policy "View trips you own or are a member of"
  on public.trips for select
  using (public.can_view_trip(id));

create policy "Create your own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Edit trips you own or can edit"
  on public.trips for update
  using (public.can_edit_trip(id))
  -- The owner cannot be reassigned by an update: the row must still belong to
  -- whoever it belonged to, and an editor cannot make themselves the owner.
  with check (public.can_edit_trip(id) and auth.uid() is not null);

create policy "Only the owner deletes a trip"
  on public.trips for delete
  using (auth.uid() = user_id);

-- Child tables ---------------------------------------------------------------
-- Identical shape for all seven: read on can_view_trip, write on can_edit_trip.
-- Written out rather than generated in a loop so the policy list is greppable
-- and a future table cannot be silently missing from it.

drop policy if exists "Users manage destinations of own trips" on public.suggested_destinations;
drop policy if exists "View destinations of visible trips" on public.suggested_destinations;
drop policy if exists "Write destinations of editable trips" on public.suggested_destinations;
create policy "View destinations of visible trips"
  on public.suggested_destinations for select
  using (public.can_view_trip(trip_id));
create policy "Write destinations of editable trips"
  on public.suggested_destinations for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage itinerary of own trips" on public.itinerary_items;
drop policy if exists "View itinerary of visible trips" on public.itinerary_items;
drop policy if exists "Write itinerary of editable trips" on public.itinerary_items;
create policy "View itinerary of visible trips"
  on public.itinerary_items for select
  using (public.can_view_trip(trip_id));
create policy "Write itinerary of editable trips"
  on public.itinerary_items for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage bookings of own trips" on public.trip_bookings;
drop policy if exists "View bookings of visible trips" on public.trip_bookings;
drop policy if exists "Write bookings of editable trips" on public.trip_bookings;
create policy "View bookings of visible trips"
  on public.trip_bookings for select
  using (public.can_view_trip(trip_id));
create policy "Write bookings of editable trips"
  on public.trip_bookings for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage phrasebooks of own trips" on public.trip_phrasebooks;
drop policy if exists "View phrasebooks of visible trips" on public.trip_phrasebooks;
drop policy if exists "Write phrasebooks of editable trips" on public.trip_phrasebooks;
create policy "View phrasebooks of visible trips"
  on public.trip_phrasebooks for select
  using (public.can_view_trip(trip_id));
create policy "Write phrasebooks of editable trips"
  on public.trip_phrasebooks for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage chat of own trips" on public.trip_chat_messages;
drop policy if exists "View chat of visible trips" on public.trip_chat_messages;
drop policy if exists "Write chat of editable trips" on public.trip_chat_messages;
create policy "View chat of visible trips"
  on public.trip_chat_messages for select
  using (public.can_view_trip(trip_id));
create policy "Write chat of editable trips"
  on public.trip_chat_messages for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage city days of own trips" on public.trip_city_days;
drop policy if exists "View city days of visible trips" on public.trip_city_days;
drop policy if exists "Write city days of editable trips" on public.trip_city_days;
create policy "View city days of visible trips"
  on public.trip_city_days for select
  using (public.can_view_trip(trip_id));
create policy "Write city days of editable trips"
  on public.trip_city_days for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

drop policy if exists "Users manage gear of own trips" on public.trip_gear;
drop policy if exists "View gear of visible trips" on public.trip_gear;
drop policy if exists "Write gear of editable trips" on public.trip_gear;
create policy "View gear of visible trips"
  on public.trip_gear for select
  using (public.can_view_trip(trip_id));
create policy "Write gear of editable trips"
  on public.trip_gear for all
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- 6. RLS on the two new tables ------------------------------------------------
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;

-- Members: you can see your own membership (so the app can list "trips shared
-- with me"), and an owner sees everyone on their trip. `is_trip_owner` and not
-- `can_view_trip`, because the latter reads this very table — the recursion the
-- header describes.
drop policy if exists "See your own membership or your trip's members" on public.trip_members;
drop policy if exists "Owner manages members" on public.trip_members;
drop policy if exists "Leave a trip you are a member of" on public.trip_members;

create policy "See your own membership or your trip's members"
  on public.trip_members for select
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- Only the owner adds or changes roles. An editor with power over the member
-- list could promote themselves, which would make the two roles the same thing.
create policy "Owner manages members"
  on public.trip_members for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

-- ...but anyone can remove themselves. Being unable to leave a trip somebody
-- else added you to is not a security property, it is a trap.
create policy "Leave a trip you are a member of"
  on public.trip_members for delete
  using (user_id = auth.uid());

-- Invites: the owner's to create, read and revoke. The invitee never selects
-- from this table — see accept_trip_invite below.
drop policy if exists "Owner manages invites" on public.trip_invites;
create policy "Owner manages invites"
  on public.trip_invites for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id) and invited_by = auth.uid());

-- 7. Redeeming an invite ------------------------------------------------------
-- SECURITY DEFINER because the caller is, by definition, someone with no access
-- to this trip yet — they cannot select the invite row that is about to grant
-- them access. They can call exactly this, with exactly one token.
--
-- Returns the trip id on success and null on every failure, so a caller cannot
-- tell "no such token" from "that invite is for a different email" by the shape
-- of the answer. The UI distinguishes them by re-reading its own session, not by
-- being told by the database.
create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite  public.trip_invites;
  v_email   text;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- The token shape is validated before it is used, so the parameter cannot be
  -- a pattern: this is a primary-key equality lookup and nothing else.
  if p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into v_invite
  from public.trip_invites
  where token = p_token and accepted_at is null;

  if not found then
    return null;
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null or v_email <> lower(v_invite.email) then
    return null;
  end if;

  -- The owner accepting their own invite would create a member row for the
  -- owner, which the schema deliberately does not have (see the table comment).
  if exists (
    select 1 from public.trips t
    where t.id = v_invite.trip_id and t.user_id = auth.uid()
  ) then
    update public.trip_invites
       set accepted_at = now(), accepted_by = auth.uid()
     where token = p_token;
    return v_invite.trip_id;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), v_invite.role)
  -- Re-accepting, or accepting a second invite at a higher role, updates the
  -- role rather than failing on the primary key.
  on conflict (trip_id, user_id) do update set role = excluded.role;

  update public.trip_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where token = p_token;

  return v_invite.trip_id;
end;
$$;

revoke all on function public.accept_trip_invite(text) from public, anon;
grant execute on function public.accept_trip_invite(text) to authenticated;

-- 8. Reading an invite before signing in --------------------------------------
-- The invite page has to say *what* you were invited to before you have an
-- account, or the login screen is asking you to trust an unexplained URL. This
-- returns the trip name, the role and the invited email — and nothing else about
-- the trip. Available to anon on purpose: it is gated on holding a 128-bit
-- token, exactly like the public share page.
create or replace function public.peek_trip_invite(p_token text)
returns table (trip_name text, role public.trip_role, email text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select t.name, i.role, i.email
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token
    and i.accepted_at is null
    and p_token ~ '^[0-9a-f]{32}$';
$$;

revoke all on function public.peek_trip_invite(text) from public;
grant execute on function public.peek_trip_invite(text) to anon, authenticated;

-- 9. Listing who has access ---------------------------------------------------
-- `profiles` is readable only by its own owner (0001), so an owner cannot see
-- the email of somebody on their trip. Widening that policy would expose a
-- profile far beyond this feature; a function scoped to one trip does not.
--
-- Gated on can_view_trip rather than is_trip_owner: everyone on a shared trip
-- can see who else is on it. That is the norm for shared documents, and the
-- alternative — being able to edit a trip without knowing who else can — is
-- worse for the people involved.
-- The output columns are prefixed (`member_*`) rather than named after the
-- table's own columns. RETURNS TABLE creates OUT parameters, and those share a
-- namespace with column references inside the body — `role` or `created_at` as
-- an output name is then ambiguous against `m.role` / `m.created_at`, and the
-- ORDER BY over a UNION has nothing unambiguous to sort by. The subquery alias
-- gives the sort a name it can resolve.
create or replace function public.list_trip_members(p_trip_id uuid)
returns table (
  member_id    uuid,
  member_email text,
  member_name  text,
  member_role  public.trip_role,
  joined_at    timestamptz,
  is_owner     boolean
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  -- The owner first, then members oldest-first. The owner is not a row in
  -- trip_members (see the table comment), so they are unioned in here — this is
  -- the one place the app wants them in the same list. Their role reads as
  -- 'editor' because that is the closest true statement about what they can do;
  -- is_owner is what the UI actually branches on.
  select * from (
    select t.user_id                   as member_id,
           p.email                     as member_email,
           p.full_name                 as member_name,
           'editor'::public.trip_role  as member_role,
           t.created_at                as joined_at,
           true                        as is_owner
      from public.trips t
      left join public.profiles p on p.id = t.user_id
     where t.id = p_trip_id
       and public.can_view_trip(p_trip_id)

    union all

    select m.user_id, p.email, p.full_name, m.role, m.created_at, false
      from public.trip_members m
      left join public.profiles p on p.id = m.user_id
     where m.trip_id = p_trip_id
       and public.can_view_trip(p_trip_id)
  ) listed
  order by listed.is_owner desc, listed.joined_at asc;
$$;

revoke all on function public.list_trip_members(uuid) from public, anon;
grant execute on function public.list_trip_members(uuid) to authenticated;

-- 10. The owner column cannot be reassigned -----------------------------------
-- A hole RLS on its own does not close, found by re-reading section 5.
--
-- The update policy on `trips` is `using (can_edit_trip(id))` with a matching
-- WITH CHECK. WITH CHECK runs against the *new* row, but `can_edit_trip(id)`
-- answers by selecting from `trips` — which inside the same statement still sees
-- the old, committed row. So an editor could send
-- `PATCH /trips?id=eq.<id> {"user_id": "<their own id>"}` straight at the REST
-- API: the check consults the pre-update row, passes, and the editor becomes the
-- owner of somebody else's trip. Nothing in the app does this, which is exactly
-- why it would not have been noticed — the Supabase REST API is reachable with
-- the anon key and a session, not only through this codebase.
--
-- A trigger is the fix rather than a column privilege: Supabase grants
-- table-level UPDATE to `authenticated`, and PostgreSQL cannot revoke one column
-- out of a table-level grant — it would mean revoking UPDATE entirely and
-- re-granting it column by column, which then silently omits every column added
-- by a future migration.
--
-- Applies to the owner too. Transferring a trip is not a feature; if it becomes
-- one it should be a function with its own rules, not a PATCH.
create or replace function public.trips_guard_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'a trip''s owner cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_no_owner_change on public.trips;
create trigger trips_no_owner_change
  before update on public.trips
  for each row execute function public.trips_guard_owner();
