-- Migration 0014 — what a booking cost
--
-- Two columns, mirroring 0011's shape: an amount and its currency, both
-- nullable so every existing row (and a booking still being priced) needs no
-- backfill.
--
-- Currency is stored as the code the user picked (ISO 4217, e.g. 'ILS',
-- 'USD', 'JPY') rather than converted to one at write time. Converting would
-- need an exchange-rate service, and the project rule is no paid services —
-- a free-tier rate API would also need refreshing to stay honest, which is a
-- job nobody asked for. The calculator sums *within* a currency and lists
-- totals side by side across currencies rather than inventing a combined
-- number; see domain/expenses.ts.
--
-- Run once in the Supabase SQL Editor.

alter table public.trip_bookings
  add column if not exists cost_amount   numeric(12, 2)
    check (cost_amount is null or cost_amount >= 0),
  add column if not exists cost_currency text;

comment on column public.trip_bookings.cost_amount is
  'What this booking cost, in cost_currency. Null when not priced yet.';
comment on column public.trip_bookings.cost_currency is
  'ISO 4217 code (e.g. ILS, USD, JPY) for cost_amount. Null when cost_amount is.';
