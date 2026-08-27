-- Migration 0019 — HOTFIX: the RLS helpers must be executable by every role
--
-- ## The bug
--
-- Migration 0018 ended each helper definition with:
--
--     revoke all on function public.can_view_trip(uuid) from public, anon;
--     grant execute on function public.can_view_trip(uuid) to authenticated;
--
-- The reasoning written there was that these functions answer a question about
-- `auth.uid()`, which is null for `anon`, so `anon` has no business calling
-- them. That reasoning is wrong, and the mistake is worth understanding because
-- it looks like hardening.
--
-- **A row-level security policy is evaluated as the role running the query.**
-- So `anon` selecting from `trips` executes the policy body — which calls
-- `can_view_trip()`. Without EXECUTE, PostgreSQL does not quietly return false:
-- it raises
--
--     42501: permission denied for function can_view_trip
--
-- and the whole query fails. Every one of the eight trip-scoped tables returned
-- an error instead of an empty result for any unauthenticated request. Measured
-- against production before this fix: `trips`, `suggested_destinations`,
-- `itinerary_items`, `trip_bookings`, `trip_city_days`, `trip_gear`,
-- `trip_phrasebooks` and `trip_chat_messages` all failed; `profiles`, which 0018
-- never touched, was fine.
--
-- Revoking from PUBLIC also stripped `service_role`, which had been relying on
-- the implicit grant. That role bypasses RLS, so nothing has failed *yet* — but
-- it is a landmine under the public share page and the notifications cron, both
-- of which run through the service-role client. It is granted back below rather
-- than left to depend on `bypassrls` staying true.
--
-- ## Why granting to anon is safe
--
-- The functions still answer only about `auth.uid()`. For `anon` that is null,
-- both EXISTS clauses are false, and the answer is false — which is exactly the
-- policy decision wanted. Nothing is disclosed by being allowed to ask. The
-- protection against anonymous reads is the policy returning false, not the
-- caller being unable to invoke the function.
--
-- ## The general rule
--
-- Any function referenced by an RLS policy must be executable by every role
-- that can reach the table — `anon` and `service_role` included. Restricting
-- EXECUTE on such a function does not narrow access; it converts "no rows" into
-- "query failed".
--
-- Run once in the Supabase SQL Editor, and run it now — production is broken
-- until it does. Idempotent.

grant execute on function public.is_trip_owner(uuid)
  to anon, authenticated, service_role;
grant execute on function public.can_view_trip(uuid)
  to anon, authenticated, service_role;
grant execute on function public.can_edit_trip(uuid)
  to anon, authenticated, service_role;

-- Not referenced by any policy, so these keep a narrower grant — but
-- service_role is added for the same landmine reason as above.
grant execute on function public.list_trip_members(uuid)
  to authenticated, service_role;
grant execute on function public.accept_trip_invite(text)
  to authenticated;
grant execute on function public.peek_trip_invite(text)
  to anon, authenticated;

-- Verification. Both of these should now return an empty result rather than
-- 42501, for a caller holding only the anon key:
--
--   select * from public.trips limit 1;
--   select * from public.trip_gear limit 1;
