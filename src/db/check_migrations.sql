-- Which migrations have actually been applied to this database
--
-- Migrations here are run by hand in the Supabase SQL Editor (README), and only
-- 0016 records itself — so there is no table that answers "what has run". This
-- asks the schema instead: for each migration, does the thing it creates exist?
--
-- Read-only. Safe to run any number of times, on any environment.
--
-- MISSING on a row means that migration has not been applied. Run the numbered
-- files in src/db/migrations in order from the first MISSING one; every one of
-- them is written to be idempotent (0016 guards itself with a table, the rest
-- use "if not exists"), so re-running one that already ran is a no-op.
--
-- Two rows cannot be checked this way and say so:
--   0005 clears cached coordinates — a data update with no schema footprint.
--   0016 is the only migration that records itself, so it is checked properly.

with checks(migration, checks_for, present) as (
  values
    ('0001_profiles', 'table profiles + handle_new_user()',
      to_regclass('public.profiles') is not null
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'handle_new_user')),

    ('0002_trips', 'tables trips, suggested_destinations, itinerary_items',
      to_regclass('public.trips') is not null
      and to_regclass('public.suggested_destinations') is not null
      and to_regclass('public.itinerary_items') is not null),

    ('0003_saved_guide', 'suggested_destinations.category',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'suggested_destinations'
                and column_name = 'category')),

    ('0004_itinerary', 'itinerary_items.day_number',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'itinerary_items'
                and column_name = 'day_number')),

    ('0005_reset_geocode', 'DATA ONLY — cannot be detected from the schema', true),

    ('0006_itinerary_city', 'itinerary_items.city',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'itinerary_items'
                and column_name = 'city')),

    ('0007_place_external_id', 'suggested_destinations.external_id',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'suggested_destinations'
                and column_name = 'external_id')),

    ('0008_trip_bookings', 'table trip_bookings',
      to_regclass('public.trip_bookings') is not null),

    ('0009_phrasebook', 'table trip_phrasebooks',
      to_regclass('public.trip_phrasebooks') is not null),

    ('0010_trip_chat', 'table trip_chat_messages',
      to_regclass('public.trip_chat_messages') is not null),

    ('0011_booking_deadlines', 'trip_bookings.free_cancellation_until',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'trip_bookings'
                and column_name = 'free_cancellation_until')),

    ('0012_push_subscriptions', 'table push_subscriptions',
      to_regclass('public.push_subscriptions') is not null),

    ('0013_city_days_and_travel', 'table trip_city_days + itinerary_items.travel_minutes',
      to_regclass('public.trip_city_days') is not null
      and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'itinerary_items'
                    and column_name = 'travel_minutes')),

    ('0014_booking_cost', 'trip_bookings.cost_amount',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'trip_bookings'
                and column_name = 'cost_amount')),

    ('0015_country_and_sharing', 'suggested_destinations.country + trips.share_token',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'suggested_destinations'
                and column_name = 'country')
      and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'trips'
                    and column_name = 'share_token')),

    -- The one migration that is not idempotent, and therefore the one that
    -- records itself. A missing row here means the booking times were never
    -- shifted out of UTC.
    ('0016_fix_booking_timezones', 'a row in applied_migrations',
      to_regclass('public.applied_migrations') is not null
      and exists (select 1 from public.applied_migrations
                  where name = '0016_fix_booking_timezones')),

    ('0017_trip_gear', 'table trip_gear',
      to_regclass('public.trip_gear') is not null),

    ('0018_trip_members', 'can_view_trip() and the invite helpers',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'can_view_trip')
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'accept_trip_invite')),

    -- Not a schema change but a grant, so this checks the grant itself: without
    -- it, `anon` selecting from trips raises 42501 instead of seeing no rows.
    ('0019_fix_rls_helper_grants', 'anon may EXECUTE can_view_trip()',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'can_view_trip'
                and has_function_privilege('anon', p.oid, 'EXECUTE'))),

    ('0020_booking_duration', 'trip_bookings.duration_minutes',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'trip_bookings'
                and column_name = 'duration_minutes'))
)
select
  migration,
  case
    when migration = '0005_reset_geocode' then 'n/a'
    when present then 'OK'
    else 'MISSING'
  end as status,
  checks_for
from checks
order by migration;
