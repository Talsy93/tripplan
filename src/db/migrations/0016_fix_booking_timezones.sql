-- Migration 0016 — correct booking times that were stored as UTC by mistake
--
-- ## The bug
--
-- A `datetime-local` input produces "2026-11-01T22:20": a wall-clock reading
-- with no timezone. The app wrote that string straight into `starts_at`, which
-- is `timestamptz`, so Postgres resolved it in the session's zone — UTC on
-- Supabase. A departure typed as 22:20 was therefore stored as 22:20+00.
--
-- Every reader resolves times in Asia/Jerusalem (APP_TIME_ZONE), so 22:20+00
-- was displayed as 00:20 the following morning. The two hours were visible in
-- the booking list, and the same shift also moved bookings to the wrong
-- calendar day in bookingsByDay, lodgingByDay and travelDayCount — a 22:20
-- flight was bucketed onto the next day of the itinerary.
--
-- The code now converts a typed time to a real instant before writing (see
-- src/lib/datetime.ts). This migration repairs the rows written before that.
--
-- ## The correction
--
--   starts_at AT TIME ZONE 'UTC'              -> the wall clock as stored: 22:20
--   (that) AT TIME ZONE 'Asia/Jerusalem'      -> 22:20 read as Jerusalem local
--
-- which is the instant the user meant. Postgres applies each row's own DST
-- rules, so a summer booking shifts by 3 hours and a winter one by 2 — doing
-- this with a fixed interval would corrupt half of them.
--
-- ## Why this one is guarded
--
-- Every other migration in this project is idempotent by construction
-- ("add column if not exists"). This one is not: it is an arithmetic shift, and
-- running it twice would move every booking a second time and leave no way to
-- tell corrected rows from doubly-corrected ones. So it records itself in a
-- small table and does nothing if that record already exists.
--
-- The table is worth having anyway — sixteen migrations in, there has been no
-- way to ask the database which of them have run.
--
-- Safe to run more than once. Run it in the Supabase SQL Editor.

create table if not exists public.applied_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

comment on table public.applied_migrations is
  'Which migrations have been applied. Only migrations that are not naturally idempotent need to check it.';

-- No RLS policy and no grants: nothing in the application reads this table, so
-- it stays reachable only by the service role and the SQL editor. RLS is still
-- enabled, so the anon and authenticated roles see nothing.
alter table public.applied_migrations enable row level security;

do $$
begin
  if exists (
    select 1 from public.applied_migrations
    where name = '0016_fix_booking_timezones'
  ) then
    raise notice 'migration 0016 already applied — skipping the time shift';
    return;
  end if;

  update public.trip_bookings
     set starts_at = (starts_at at time zone 'UTC') at time zone 'Asia/Jerusalem',
         ends_at   = case
                       when ends_at is null then null
                       else (ends_at at time zone 'UTC') at time zone 'Asia/Jerusalem'
                     end;

  insert into public.applied_migrations (name)
  values ('0016_fix_booking_timezones');

  raise notice 'migration 0016 applied: booking times shifted to Asia/Jerusalem wall clock';
end
$$;

-- Only trip_bookings is touched. The other timestamptz columns in the schema
-- are set by the server with now() or an ISO instant and were never wall-clock
-- strings: created_at, cancel_notified_at, book_by_notified_at, shared_at.
-- free_cancellation_until and book_by are `date` columns and have no time to
-- get wrong — see the note in migration 0011.
