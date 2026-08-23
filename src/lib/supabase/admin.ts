import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// A Supabase client that bypasses Row Level Security.
//
// Exists for exactly two callers, both of which need to read data on behalf of
// someone who has no session at all:
//
//   1. The nightly reminder job, which asks "which bookings across ALL users
//      have a deadline due today".
//   2. The public share page (migration 0015), whose visitor is a stranger
//      with a token and nothing else. RLS is written entirely in terms of
//      auth.uid(), so it returns nothing for them. The alternative — an RLS
//      policy letting anon read any row with a non-null share_token — also
//      permits listing every shared trip in the database, which makes the
//      token pointless. See infrastructure/share-service.ts for the three
//      properties that keep that path safe.
//
// Every other path in this app goes through a user's session and is bounded by
// RLS — that is the project's main security property (iron rule #4 / migration
// 0002) and this file is the documented hole in it.
//
// Three guards, because a service-role key is the one credential that can read
// every user's data:
//
//   1. It is read from a server-only variable. A NEXT_PUBLIC_ prefix would ship
//      it to the browser, which is why the name deliberately lacks one.
//   2. It throws rather than falling back to the anon key. Silently degrading
//      would produce a job that "works" and quietly reminds nobody.
//   3. No session is persisted and no token is auto-refreshed — this client is
//      constructed per request and is never a user.
//
// Never import this from a component, a Server Action, or any route that runs
// on behalf of a signed-in user.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
