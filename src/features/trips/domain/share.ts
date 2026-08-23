import type { Booking } from "./booking";
import type { ItineraryDay } from "./ai-suggestion";
import type { RouteStop } from "./route";

// What a public link is allowed to contain.
//
// The trip as a whole is not shareable — a *redaction of it* is. That
// distinction is the whole design: the share page is rendered from this type,
// not from the Trip aggregate, so a field can only reach a stranger by being
// added here on purpose. A future column on trip_bookings is invisible to the
// public page until someone writes it into redactBooking below, which is the
// opposite of the usual failure mode where new data leaks by default.
//
// Three things are deliberately absent, per the owner's choice when the
// feature was specified:
//
//   * `confirmation` — a reservation code is enough to modify or cancel the
//     booking at most providers. It is the single most dangerous field here.
//   * `address` — the exact building the traveller sleeps in, on a link that
//     needs no password and may be forwarded anywhere.
//   * `cost_amount` / `cost_currency` — what the trip cost is nobody's
//     business but the traveller's.
//
// The hotel's *name* and city stay, because "we're at the Prince Kyoto on the
// 4th" is the point of sharing an itinerary at all.

export type SharedBooking = {
  id: string;
  kind: Booking["kind"];
  title: string;
  origin: string | null;
  destination: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  // Kept: a note usually says "take the west exit", which is the kind of
  // thing a travelling companion needs. It is free text the owner wrote
  // themselves, so unlike the fields above it holds nothing the app put there.
  note: string | null;
};

export type SharedTrip = {
  name: string;
  startDate: string | null;
  endDate: string | null;
  itinerary: ItineraryDay[];
  bookings: SharedBooking[];
  stops: RouteStop[];
};

export function redactBooking(booking: Booking): SharedBooking {
  return {
    id: booking.id,
    kind: booking.kind,
    title: booking.title,
    origin: booking.origin,
    destination: booking.destination,
    city: booking.city,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    note: booking.note,
  };
}

// A share token, as the URL carries it.
//
// 32 lowercase hex characters — 128 bits, which is not guessable by any
// practical means, and no ambiguous characters to mistype when the link is
// read aloud or copied by hand.
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function isShareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

// Generated with the platform CSPRNG. Math.random is not one and must never be
// used here — the token is the only thing standing between a stranger and the
// trip.
export function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
