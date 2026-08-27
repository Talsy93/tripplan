import * as z from "zod";

// Who can reach a trip besides the person who created it.
//
// Mirrors public.trip_members and public.trip_invites (migration 0018).
//
// This is the third and narrowest of three access mechanisms, and the three are
// deliberately different — the migration header has the full reasoning. Short
// version:
//
//   * `share_token` (0015): anonymous, read-only, redacted. Anyone with the URL.
//   * `viewer` here: a named account, reads the trip in full through the app.
//   * `editor` here: the same, and writes.
//
// A member sees the un-redacted trip. That is the point: a link can be forwarded
// to anyone, whereas a member is an account the owner named on purpose, and the
// person travelling with you needs the hotel address and the booking reference.

export const tripRoleSchema = z.enum(["viewer", "editor"]);
export type TripRole = z.infer<typeof tripRoleSchema>;

export const TRIP_ROLES: Record<
  TripRole,
  { label: string; hint: string }
> = {
  viewer: {
    label: "צפייה בלבד",
    hint: "רואה את כל הטיול — כולל כתובות, מספרי אישור ומחירים — ולא יכול לשנות כלום.",
  },
  editor: {
    label: "צפייה ועריכה",
    hint: "יכול להוסיף ולשנות הזמנות, יעדים, לו״ז וציוד. לא יכול למחוק את הטיול.",
  },
};

export const TRIP_ROLE_ORDER: TripRole[] = ["viewer", "editor"];

// A person with access, as list_trip_members returns them. The owner is included
// in that list with is_owner = true — they are not a row in trip_members, so this
// is the one shape that describes both.
export const tripMemberSchema = z.object({
  member_id: z.uuid(),
  member_email: z.email().nullable(),
  member_name: z.string().nullable(),
  member_role: tripRoleSchema,
  joined_at: z.string(),
  is_owner: z.boolean(),
});
export type TripMember = z.infer<typeof tripMemberSchema>;

export const tripInviteSchema = z.object({
  token: z.string(),
  trip_id: z.uuid(),
  email: z.string(),
  role: tripRoleSchema,
  created_at: z.string(),
  accepted_at: z.string().nullable(),
});
export type TripInvite = z.infer<typeof tripInviteSchema>;

// What peek_trip_invite returns to someone who is not signed in yet.
export type InvitePreview = {
  tripName: string;
  role: TripRole;
  email: string;
};

export const inviteFormSchema = z.object({
  // Lowercased here so the stored value and the comparison on acceptance agree.
  // Trimmed first, because a pasted address very often carries a trailing space.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("כתבו כתובת אימייל תקינה")),
  role: tripRoleSchema,
});
export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export type InviteFormState =
  | { message?: string; errors?: { email?: string[]; role?: string[] } }
  | undefined;

// The invite action's result, which carries the issued token on success.
//
// Spelled out as its own union rather than as `InviteFormState & { token?: … }`.
// An intersection distributes over a union, and `undefined & { token?: string }`
// collapses to `never` — so the intersection quietly dropped the `undefined`
// member and useActionState's initial value stopped type-checking.
export type InviteActionState =
  | {
      message?: string;
      errors?: { email?: string[]; role?: string[] };
      token?: string;
    }
  | undefined;

export function inviteUrl(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}

// ---- Delivering the link to a phone number --------------------------------
//
// The app cannot send an SMS and will not be able to: Supabase phone auth needs
// a paid provider (Twilio, MessageBird, Vonage), and this project does not use
// paid services. So a phone number is not an identity here — it is a *channel*.
// The owner types one, and the app builds a link that opens their own WhatsApp
// or their own SMS app with the invite already written. It costs nothing, needs
// no API key, and the message comes from a number the recipient recognises,
// which is the reason a stranger's SMS gets ignored.
//
// The identity that finally redeems the invite is still the email address.

// The country assumed when a number is written the local way, starting with 0.
// Israel, because that is where this app's users are; a number typed with a
// leading + or a country code is used exactly as written and ignores this.
const DEFAULT_COUNTRY_CODE = "972";

// wa.me and the sms: scheme both want digits only, no +, no punctuation.
//
// Returns null rather than a best guess when the result cannot be a real number.
// A wa.me link built from nonsense opens WhatsApp on an error screen, which
// reads as the app being broken rather than as the input being wrong.
export function normalizePhone(
  raw: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // A leading + means the country code is already there, whatever it is.
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  let full: string;
  if (hadPlus) {
    full = digits;
  } else if (digits.startsWith("00")) {
    // The other way of writing +, still in wide use on printed cards.
    full = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Local form: 05X-XXXXXXX → 9725XXXXXXXX. The trunk zero is dropped, not
    // kept — "972 0 50..." is not a number anywhere.
    full = countryCode + digits.slice(1);
  } else if (digits.startsWith(countryCode)) {
    full = digits;
  } else {
    // No leading zero and no country code: assume it is local without the trunk
    // prefix, which is how people write a number when they are already thinking
    // about their own country.
    full = countryCode + digits;
  }

  // E.164 allows 8–15 digits including the country code. Anything outside that
  // is a typo, not a number this app should hand to WhatsApp.
  if (full.length < 8 || full.length > 15) return null;
  return full;
}

// Opens the owner's own WhatsApp with the message ready to send. `wa.me` is
// WhatsApp's official click-to-chat host and needs no account or key.
export function whatsappUrl(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

// The same, through the phone's SMS app. Kept as a fallback for a recipient who
// does not use WhatsApp; the owner pays for the SMS, not the app.
export function smsUrl(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  // `?&body=` — the ampersand after the question mark is the form iOS accepts,
  // and Android tolerates it. `?body=` alone is ignored by iOS Messages.
  return `sms:+${normalized}?&body=${encodeURIComponent(message)}`;
}

// The message that carries the link. One place, so WhatsApp and SMS cannot end
// up saying different things, and so the wording is reviewable as copy.
export function inviteMessage(
  tripName: string,
  url: string,
  role: TripRole,
): string {
  const what =
    role === "editor"
      ? "לצפות ולערוך את הטיול"
      : "לצפות בטיול";
  return `הוזמנת ${what} ״${tripName}״ ב-MyTrip. הקישור אישי ותקף פעם אחת: ${url}`;
}

// Splits the list from list_trip_members into the owner and everyone else. The
// UI treats them differently — the owner has no role to change and cannot be
// removed — and doing the split here keeps that rule out of the markup.
export function splitMembers(members: TripMember[]): {
  owner: TripMember | null;
  others: TripMember[];
} {
  return {
    owner: members.find((member) => member.is_owner) ?? null,
    others: members.filter((member) => !member.is_owner),
  };
}

// A display name for a person, from whatever the profile happens to hold.
// Falls back to the local part of the email, and then to a generic label —
// never to an empty row, which reads as a bug rather than as missing data.
export function memberLabel(member: TripMember): string {
  if (member.member_name && member.member_name.trim() !== "") {
    return member.member_name;
  }
  if (member.member_email) {
    return member.member_email;
  }
  return "משתמש";
}
