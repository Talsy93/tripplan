import { createClient } from "@/lib/supabase/server";
import { generateShareToken, isShareToken } from "../domain/share";
import {
  tripInviteSchema,
  tripMemberSchema,
  type InvitePreview,
  type TripInvite,
  type TripMember,
  type TripRole,
} from "../domain/membership";

// Membership and invitations (migration 0018).
//
// Everything here goes through the caller's own session. The access rules live
// in the database — in the RLS policies and in the SECURITY DEFINER functions
// the migration defines — not in this file. That is deliberate: a rule written
// here would apply only to callers who come through this codebase, and the
// Supabase REST API is reachable with an anon key and a session.

// ---- Reading -------------------------------------------------------------

// Everyone with access, owner included. Readable by any member (see the
// migration for why viewers get to know who else is on the trip).
export async function listMembers(tripId: string): Promise<TripMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_trip_members", {
    p_trip_id: tripId,
  });

  if (error || !data) {
    if (error) console.error("listMembers failed:", error.message);
    return [];
  }

  return (data as unknown[]).flatMap((row) => {
    const parsed = tripMemberSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

// Invites that have not been redeemed yet. Owner-only by RLS, so a non-owner
// gets an empty list rather than an error — which is the right shape for a
// panel that simply does not render the section.
export async function listOpenInvites(tripId: string): Promise<TripInvite[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trip_invites")
    .select("token, trip_id, email, role, created_at, accepted_at")
    .eq("trip_id", tripId)
    .is("accepted_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("listOpenInvites failed:", error.message);
    return [];
  }

  return data.flatMap((row) => {
    const parsed = tripInviteSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

// What an invite is for, for the landing page — before the visitor has an
// account, and therefore before they can be expected to trust the URL.
//
// Returns the trip's name, the offered role and the invited email, and nothing
// else about the trip. Reachable without a session on purpose: it is gated on
// holding a 128-bit token, exactly like the public share page.
export async function peekInvite(token: string): Promise<InvitePreview | null> {
  if (!isShareToken(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_trip_invite", {
    p_token: token,
  });

  if (error || !data) {
    if (error) console.error("peekInvite failed:", error.message);
    return null;
  }

  // A set-returning function comes back as an array of rows.
  const row = (data as { trip_name: string; role: string; email: string }[])[0];
  if (!row) return null;

  return {
    tripName: row.trip_name,
    role: row.role === "editor" ? "editor" : "viewer",
    email: row.email,
  };
}

// Whether the caller may write to this trip. Asked so the UI can render a
// read-only view for a viewer rather than showing controls that will be refused.
//
// This is a *display* decision only. The enforcement is the RLS policy; if these
// two ever disagree the database wins, which is the correct direction for them
// to disagree in.
export async function canEditTrip(tripId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_trip", {
    p_trip_id: tripId,
  });

  if (error) {
    console.error("canEditTrip failed:", error.message);
    // Fail closed. A wrongly read-only screen is a nuisance; a wrongly editable
    // one shows controls whose every action then fails.
    return false;
  }
  return data === true;
}

export async function isTripOwner(tripId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_trip_owner", {
    p_trip_id: tripId,
  });

  if (error) {
    console.error("isTripOwner failed:", error.message);
    return false;
  }
  return data === true;
}

// ---- Writing -------------------------------------------------------------

// Issues an invite and returns its token.
//
// Re-inviting the same address replaces the open invite rather than adding a
// second one: the partial unique index in the migration would reject the insert,
// and two live links for one person is not a state anyone wants to reason about.
// The previous token stops working, which is the honest meaning of "I changed
// what I was offering you".
export async function createInvite(input: {
  tripId: string;
  email: string;
  role: TripRole;
}): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Deleted first, in the same normalised form the insert will store, so the
  // unique index cannot reject us for a row we are about to replace.
  await supabase
    .from("trip_invites")
    .delete()
    .eq("trip_id", input.tripId)
    .eq("email", input.email)
    .is("accepted_at", null);

  const token = generateShareToken();
  const { error } = await supabase.from("trip_invites").insert({
    token,
    trip_id: input.tripId,
    email: input.email,
    role: input.role,
    invited_by: user.id,
  });

  if (error) {
    console.error("createInvite failed:", error.message);
    return null;
  }
  return token;
}

export async function revokeInvite(
  tripId: string,
  token: string,
): Promise<boolean> {
  if (!isShareToken(token)) return false;
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trip_invites")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("token", token);

  if (error) console.error("revokeInvite failed:", error.message);
  return !error && count !== 0;
}

// Redeems an invite for the signed-in account, returning the trip id.
//
// All the rules are inside the database function: the token shape, that the
// invite is still open, and that the caller's email matches the invited one. It
// returns null for every failure without saying which, so a stranger holding a
// forwarded link learns nothing from the response.
export async function acceptInvite(token: string): Promise<string | null> {
  if (!isShareToken(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_trip_invite", {
    p_token: token,
  });

  if (error) {
    console.error("acceptInvite failed:", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function setMemberRole(
  tripId: string,
  userId: string,
  role: TripRole,
): Promise<boolean> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trip_members")
    .update({ role }, { count: "exact" })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) console.error("setMemberRole failed:", error.message);
  return !error && count !== 0;
}

// Removes somebody's access. Two policies allow this delete — the owner
// removing a member, and a member removing themselves — so the same call serves
// "remove" and "leave".
export async function removeMember(
  tripId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trip_members")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) console.error("removeMember failed:", error.message);
  return !error && count !== 0;
}
