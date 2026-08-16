"use server";

import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  deleteSubscription,
  hasSubscription,
  saveSubscription,
} from "../infrastructure/push-service";

// A subscription arrives from the browser, so it is untrusted input even though
// the browser is the one that generated it. The endpoint is a URL belonging to a
// push service; the keys are base64url.
const subscriptionSchema = z.object({
  endpoint: z.url({ error: "כתובת לא תקינה." }).max(2000),
  p256dh: z.string().min(1).max(255),
  auth: z.string().min(1).max(255),
  userAgent: z.string().max(500).optional(),
});

export async function registerPushSubscription(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "צריך להיות מחובר." };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "מנוי לא תקין." };

  // The user id comes from the session, never from the client — otherwise a
  // caller could register a device against somebody else's account.
  const ok = await saveSubscription(user.id, parsed.data);
  return ok ? { ok: true } : { ok: false, message: "השמירה נכשלה." };
}

export async function unregisterPushSubscription(
  endpoint: unknown,
): Promise<boolean> {
  const parsed = z.string().min(1).max(2000).safeParse(endpoint);
  if (!parsed.success) return false;
  // RLS scopes the delete to the caller's own rows, so an endpoint belonging to
  // someone else simply matches nothing.
  return deleteSubscription(parsed.data);
}

export async function isPushRegistered(endpoint: unknown): Promise<boolean> {
  const parsed = z.string().min(1).max(2000).safeParse(endpoint);
  if (!parsed.success) return false;
  return hasSubscription(parsed.data);
}
