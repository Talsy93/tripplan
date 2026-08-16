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
  // Added in 0011 — the deadlines attached to a booking. The two dates are
  // `date` columns, so they arrive as plain YYYY-MM-DD rather than timestamps.
  free_cancellation_until: z.string().nullable(),
  book_by: z.string().nullable(),
  booked: z.boolean(),
  // Null means "use the app default" — see reminderDays below.
  reminder_days_before: z.number().int().nullable(),
  // When each push was sent. Null = not sent yet; set once, so a reminder
  // fires at the chosen lead time and not on every run after it.
  cancel_notified_at: z.string().nullable(),
  book_by_notified_at: z.string().nullable(),
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
    // 0011. All optional: most bookings have none of them.
    freeCancellationUntil: z.string().optional(),
    bookBy: z.string().optional(),
    // False for something still to be reserved. The form sends a checkbox.
    booked: z.boolean().optional(),
    // Matches the column's own bounds, so the check constraint can never be the
    // thing that reports a bad value.
    reminderDaysBefore: z
      .number()
      .int({ error: "מספר הימים חייב להיות שלם." })
      .min(0, { error: "מספר הימים לא יכול להיות שלילי." })
      .max(60, { error: "אפשר להזכיר עד 60 ימים מראש." })
      .optional(),
  })
  .refine(
    (value) =>
      !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt),
    { error: "מועד הסיום חייב להיות אחרי ההתחלה.", path: ["endsAt"] },
  )
  // A deadline after the booking has already begun describes nothing that can
  // be acted on, and is almost always a typo in the year.
  //
  // Compared as YYYY-MM-DD strings, which sort correctly: the deadline is a date
  // and startsAt is a datetime-local, so parsing both as Date would compare
  // midnight against an afternoon and reject a deadline on the check-in day —
  // which is exactly when a hotel's free cancellation usually expires.
  .refine(
    (value) =>
      !value.freeCancellationUntil ||
      value.freeCancellationUntil <= value.startsAt.slice(0, 10),
    {
      error: "מועד הביטול חייב להיות לפני תחילת ההזמנה.",
      path: ["freeCancellationUntil"],
    },
  )
  .refine(
    (value) => !value.bookBy || value.bookBy <= value.startsAt.slice(0, 10),
    { error: "מועד ההזמנה חייב להיות לפני תחילת ההזמנה.", path: ["bookBy"] },
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

// A deadline is a calendar date, and it is stored as one (0011). Returns the
// plain YYYY-MM-DD, or null for anything else — a malformed value becomes "no
// deadline" rather than a row the alerts cannot read.
export function deadlineDate(date: string | undefined): string | null {
  const trimmed = date?.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // Rejects 2026-02-31 and friends: the calendar has to agree the day exists.
  const [year, month, day] = trimmed.split("-").map(Number);
  const asDate = new Date(year, month - 1, day);
  if (
    asDate.getFullYear() !== year ||
    asDate.getMonth() !== month - 1 ||
    asDate.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

// A YYYY-MM-DD read back from the database, as a Date at *local* midnight.
//
// `new Date("2026-09-10")` is not this: the string form is parsed as UTC, so a
// reader west of UTC gets the previous evening and every day-count comes out one
// short. Building from components keeps the date the date it says it is,
// whatever the reader's timezone.
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---- Deadline alerts (0011) -----------------------------------------------
//
// Two deadlines, and they behave differently once they pass — which is the
// whole point of keeping them apart:
//
//   A free-cancellation deadline that has passed is a closed door. There is
//   nothing left to do, so the alert stops. Saying "you missed it" every time
//   the screen opens is nagging about something unfixable.
//
//   A booking deadline that has passed is an open problem. The train still
//   needs booking, and it just got harder — so the alert stays and escalates.
//
// How many days ahead a deadline starts being mentioned when the booking does
// not say. Wider than the departure window in bookingAlert (3 days), because
// cancelling and booking are errands that need planning, not things you do on
// the way to the airport.
export const DEFAULT_REMINDER_DAYS = 7;

// The choices offered in the form. "Custom" is a number input rather than an
// entry here, so this list stays the set of one-tap answers.
export const REMINDER_PRESETS = [1, 2, 3, 7, 14, 30] as const;

// The lead time a booking actually uses. Clamped to the range the column
// allows, so a value that somehow got past validation cannot produce a window
// that never opens or never closes.
export function reminderDays(
  booking: Pick<Booking, "reminder_days_before">,
): number {
  const raw = booking.reminder_days_before;
  if (raw === null || raw === undefined || !Number.isFinite(raw)) {
    return DEFAULT_REMINDER_DAYS;
  }
  return Math.min(Math.max(Math.trunc(raw), 0), 60);
}

// "Cancel the second hotel by Thursday" — while that is still possible.
export function cancellationAlert(
  booking: Pick<Booking, "free_cancellation_until" | "reminder_days_before">,
  now: Date,
): BookingAlert | null {
  if (!booking.free_cancellation_until) return null;

  const deadline = parseLocalDate(booking.free_cancellation_until);
  if (!deadline) return null;

  const days = calendarDaysBetween(now, deadline);
  // Passed: free cancellation is no longer on the table.
  if (days < 0) return null;
  if (days > reminderDays(booking)) return null;

  if (days === 0) {
    return { urgency: "now", message: "ביטול חינם עד היום" };
  }
  if (days === 1) {
    return { urgency: "now", message: "ביטול חינם עד מחר" };
  }
  return {
    urgency: days <= 3 ? "soon" : "upcoming",
    message: `ביטול חינם עוד ${days} ימים`,
  };
}

// "Book the train — the deadline is in 5 days", and louder once it has gone.
//
// Only meaningful while the thing is unbooked; a reservation that exists has no
// booking deadline left to miss.
export function bookingTodoAlert(
  booking: Pick<Booking, "book_by" | "booked" | "reminder_days_before">,
  now: Date,
): BookingAlert | null {
  if (booking.booked) return null;
  if (!booking.book_by) {
    // Unbooked with no deadline is still worth a nudge — it is a to-do the user
    // wrote down — but it is not urgent and it never escalates.
    return { urgency: "upcoming", message: "עוד לא הוזמן" };
  }

  const deadline = parseLocalDate(booking.book_by);
  if (!deadline) {
    return { urgency: "upcoming", message: "עוד לא הוזמן" };
  }

  const days = calendarDaysBetween(now, deadline);
  // Overdue, and unlike a cancellation this still needs doing.
  if (days < 0) {
    return { urgency: "now", message: "עבר מועד ההזמנה!" };
  }
  if (days === 0) return { urgency: "now", message: "להזמין היום!" };
  if (days === 1) return { urgency: "now", message: "להזמין עד מחר" };
  if (days > reminderDays(booking)) {
    return { urgency: "upcoming", message: "עוד לא הוזמן" };
  }
  return {
    urgency: days <= 3 ? "soon" : "upcoming",
    message: `להזמין עוד ${days} ימים`,
  };
}

// ---- Double booking -------------------------------------------------------

// The ids of lodging bookings that share at least one night with another.
//
// C3's lodgingByDay already meets this situation and resolves it silently — it
// picks the latest check-in and moves on, which is right for "where do I sleep"
// but hides the fact that two rooms are being paid for. This reports it instead.
//
// Nights, not raw timestamps: two hotels booked for the same dates overlap even
// though check-in times differ by hours, and a hotel whose check-out is the
// other's check-in does not overlap at all — you moved.
export function doubleBookedLodgingIds(
  bookings: Booking[],
  zone: string,
): Set<string> {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone });
  const dateOf = (iso: string): string | null => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? null : formatter.format(at);
  };

  const stays: { id: string; from: string; to: string }[] = [];
  for (const booking of bookings) {
    if (booking.kind !== "lodging") continue;
    const from = dateOf(booking.starts_at);
    if (!from) continue;
    const rawTo = booking.ends_at ? dateOf(booking.ends_at) : null;
    // Without a check-out the stay is one night, matching lodgingByDay. `to` is
    // exclusive — the morning you leave.
    const to = rawTo && rawTo > from ? rawTo : nextDate(from);
    stays.push({ id: booking.id, from, to });
  }

  const clashing = new Set<string>();
  for (let i = 0; i < stays.length; i += 1) {
    for (let j = i + 1; j < stays.length; j += 1) {
      const a = stays[i];
      const b = stays[j];
      // Half-open ranges: [from, to). Touching ends are a handover, not a clash.
      if (a.from < b.to && b.from < a.to) {
        clashing.add(a.id);
        clashing.add(b.id);
      }
    }
  }
  return clashing;
}

// One day after a YYYY-MM-DD date, as YYYY-MM-DD. Uses UTC arithmetic so it
// cannot be shifted by the machine's own offset.
function nextDate(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString().slice(0, 10);
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
