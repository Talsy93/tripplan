"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  inviteFormSchema,
  tripRoleSchema,
  type InviteActionState,
} from "../domain/membership";
import {
  acceptInvite,
  createInvite,
  removeMember,
  revokeInvite,
  setMemberRole,
} from "../infrastructure/membership-service";

const tripIdSchema = z.uuid();

// Creating an invite returns the token, because the owner then has to *deliver*
// the link themselves — through WhatsApp, SMS or their own mail. The app does
// not send it: Supabase's built-in mailer is rate-limited to a handful of
// messages an hour on the free tier, and a paid SMTP or SMS provider is out
// (see the decision log). Handing the owner a link they send from an app the
// recipient already trusts is both free and more likely to be opened than a
// transactional email from a domain nobody recognises.
export async function inviteToTrip(
  _state: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const tripId = tripIdSchema.safeParse(formData.get("tripId"));
  if (!tripId.success) return { message: "טיול לא תקין." };

  const parsed = inviteFormSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const token = await createInvite({ tripId: tripId.data, ...parsed.data });
  if (!token) {
    return { message: "יצירת ההזמנה נכשלה. נסו שוב." };
  }

  revalidatePath(`/trips/${tripId.data}`, "layout");
  return { token };
}

export async function cancelInvite(
  tripId: string,
  token: string,
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  if (!parsedTrip.success) return false;

  const ok = await revokeInvite(parsedTrip.data, token);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

export async function changeMemberRole(
  tripId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  const parsedUser = z.uuid().safeParse(userId);
  const parsedRole = tripRoleSchema.safeParse(role);
  if (!parsedTrip.success || !parsedUser.success || !parsedRole.success) {
    return false;
  }

  const ok = await setMemberRole(
    parsedTrip.data,
    parsedUser.data,
    parsedRole.data,
  );
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

export async function revokeMember(
  tripId: string,
  userId: string,
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  const parsedUser = z.uuid().safeParse(userId);
  if (!parsedTrip.success || !parsedUser.success) return false;

  const ok = await removeMember(parsedTrip.data, parsedUser.data);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

// Redeeming an invite. Returns the trip id so the caller can navigate straight
// into the trip, which is the only reasonable next screen.
export async function redeemInvite(token: string): Promise<string | null> {
  const tripId = await acceptInvite(token);
  if (tripId) {
    // The invitee's own trip list gains a trip, and the trip itself gains a
    // member — both are cached renders that are now wrong.
    revalidatePath("/profile");
    revalidatePath(`/trips/${tripId}`, "layout");
  }
  return tripId;
}
