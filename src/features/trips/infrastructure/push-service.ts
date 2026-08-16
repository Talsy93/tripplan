import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushTarget } from "@/lib/push";

// The devices a user asked to be reminded on (migration 0012).
//
// These functions run as the signed-in user, so RLS is the authorisation check —
// nobody can register or read a device against someone else's account. The
// nightly job reads across users and therefore uses a different client entirely;
// see src/lib/supabase/admin.ts.

export type NewSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

// Registers this browser for reminders.
//
// Upsert on `endpoint`: the browser hands back the same endpoint for the same
// device, so subscribing twice — a second visit, a re-granted permission —
// has to update the existing row rather than pile up duplicates that would each
// receive their own copy of every reminder.
export async function saveSubscription(
  userId: string,
  subscription: NewSubscription,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: subscription.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("saveSubscription failed:", error.message);
    return false;
  }
  return true;
}

export async function deleteSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    console.error("deleteSubscription failed:", error.message);
    return false;
  }
  return true;
}

// Whether this browser is already registered — so the toggle can show its real
// state instead of guessing from the browser's permission alone. Permission
// being granted does not mean a subscription reached the database.
export async function hasSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  return Boolean(data);
}

// Rows shaped for the sender. Used only by the reminder job, which passes the
// admin client in explicitly — the crossing of users is a visible argument at
// the call site rather than something this module decides on its own.
export async function subscriptionsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<(PushTarget & { id: string })[]> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !data) {
    if (error) console.error("subscriptionsForUser failed:", error.message);
    return [];
  }
  return data as (PushTarget & { id: string })[];
}
