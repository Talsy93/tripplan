import * as z from "zod";

// The trip's logistics: how you get there and where you sleep.
//
// Mirrors public.trip_bookings (migration 0008). One shape for flights, trains
// and lodging — see the migration for why they share a table.

export const bookingKindSchema = z.enum(["flight", "train", "lodging"]);
export type BookingKind = z.infer<typeof bookingKindSchema>;

export const BOOKING_KINDS: Record<
  BookingKind,
  { label: string; emoji: string; isTransport: boolean }
> = {
  flight: { label: "טיסה", emoji: "✈️", isTransport: true },
  train: { label: "רכבת", emoji: "🚆", isTransport: true },
  lodging: { label: "לינה", emoji: "🏨", isTransport: false },
};

export const bookingSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  kind: bookingKindSchema,
  title: z.string().min(1),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  city: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  address: z.string().nullable(),
  confirmation: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
});
export type Booking = z.infer<typeof bookingSchema>;

// What a form is allowed to submit. `starts_at`/`ends_at` arrive as the strings
// a datetime-local input produces, which have no timezone — they're read as the
// user's own wall clock, which is what someone typing a departure time means.
export const createBookingSchema = z
  .object({
    tripId: z.uuid(),
    kind: bookingKindSchema,
    title: z.string().trim().min(1, { error: "יש לציין שם או מספר." }).max(120),
    origin: z.string().trim().max(120).optional(),
    destination: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
    startsAt: z.string().min(1, { error: "יש לציין מועד." }),
    endsAt: z.string().optional(),
    address: z.string().trim().max(300).optional(),
    confirmation: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) =>
      !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt),
    { error: "מועד הסיום חייב להיות אחרי ההתחלה.", path: ["endsAt"] },
  );
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type BookingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CreateBookingInput, string[]>>;
  // What was submitted, echoed back. React resets an uncontrolled form once
  // its action finishes — including when it failed — so without this a
  // rejected form throws away everything that was typed. Absent on success,
  // which is what clears the form.
  values?: Partial<Record<keyof CreateBookingInput, string>>;
};

// ---- Alerts ---------------------------------------------------------------
// Derived, never stored. "Your flight is in 3 hours" is a function of the
// booking's time and now — storing it would mean keeping it in sync with the
// clock, which is a job nobody wants.

export type BookingAlert = {
  urgency: "now" | "soon" | "upcoming";
  message: string;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// `now` is a parameter rather than read from the clock so this stays pure and
// testable, and so a server render and a client render can agree on it.
//
// "Tomorrow" is decided by the calendar, not by elapsed time. Bucketing on
// hours alone called a departure eight hours away "tomorrow" when it was the
// same evening — an alert that says something false is worse than no alert.
export function bookingAlert(
  booking: Pick<Booking, "kind" | "starts_at">,
  now: Date,
): BookingAlert | null {
  const starts = new Date(booking.starts_at);
  const ms = starts.getTime() - now.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;

  const verb = booking.kind === "lodging" ? "צ׳ק-אין" : "יציאה";
  const days = calendarDaysBetween(now, starts);

  if (days === 0) {
    // Under an hour, minutes are what matters — rounding 30 minutes up to
    // "an hour" is the difference between calm and missing it.
    if (ms < HOUR_MS) {
      const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
      return { urgency: "now", message: `${verb} בעוד ${minutes} דק׳` };
    }
    const hours = Math.round(ms / HOUR_MS);
    return {
      urgency: ms <= 3 * HOUR_MS ? "now" : "soon",
      message: `${verb} היום, בעוד ${hours === 1 ? "שעה" : `${hours} שעות`}`,
    };
  }
  if (days === 1) {
    return { urgency: "soon", message: `${verb} מחר` };
  }
  if (days <= 3) {
    return { urgency: "upcoming", message: `${verb} בעוד ${days} ימים` };
  }
  return null;
}

// Whole days between two moments by the calendar the reader lives in, so
// "tomorrow" means the next date rather than 24 hours from now.
function calendarDaysBetween(from: Date, to: Date) {
  const startOfFrom = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );
  const startOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / DAY_MS);
}

// ---- Display --------------------------------------------------------------

export function bookingWhere(booking: Booking) {
  if (BOOKING_KINDS[booking.kind].isTransport) {
    const legs = [booking.origin, booking.destination].filter(Boolean);
    return legs.length === 2 ? legs.join(" → ") : (legs[0] ?? null);
  }
  return booking.address ?? booking.city;
}

// Nights for a lodging booking — the same counting rule the route map uses:
// a night is a transition between days. Counted on the calendar, so a check-in
// and check-out on the same date is no nights rather than one.
export function bookingNights(booking: Booking): number | null {
  if (booking.kind !== "lodging" || !booking.ends_at) return null;

  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const nights = calendarDaysBetween(start, end);
  return nights > 0 ? nights : null;
}
