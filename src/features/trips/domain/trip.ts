import * as z from "zod";

// Trip state machine — see ARCHITECTURE.md iron rule #6.
export const tripStatusSchema = z.enum([
  "planning",
  "executing",
  "completed",
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

// Mirrors public.trips (see src/db/migrations/0002_trips.sql).
export const tripSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().min(1),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: tripStatusSchema,
  created_at: z.string(),
});
export type Trip = z.infer<typeof tripSchema>;

// Input schema for creating a trip (thin slice — name only for now).
// A calendar date in ISO form (YYYY-MM-DD), matching an <input type="date">.
const isoDate = (error: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error });

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, { error: "יש להזין שם לטיול." }),
    // Optional at creation, and that is the point of asking here rather than
    // requiring here: dates are what most of the app derives from, so the form
    // should offer them — but "I know I want to go to Japan" is a real place to
    // start and must not be blocked.
    //
    // The empty string is what a blank <input type="date"> submits, so it is
    // accepted and normalised to null rather than failing the regex.
    start_date: isoDate("תאריך יציאה לא תקין.")
      .nullish()
      .or(z.literal("").transform(() => null)),
    end_date: isoDate("תאריך חזרה לא תקין.")
      .nullish()
      .or(z.literal("").transform(() => null)),
  })
  .refine((v) => !v.end_date || !v.start_date || v.end_date >= v.start_date, {
    error: "תאריך החזרה חייב להיות באותו יום או אחרי היציאה.",
    path: ["end_date"],
  })
  // A return date with no departure has nothing to be after, and the trip would
  // land in the same undated state with one field quietly ignored.
  .refine((v) => !v.end_date || !!v.start_date, {
    error: "כדי לקבוע חזרה צריך קודם תאריך יציאה.",
    path: ["end_date"],
  });
export type CreateTripInput = z.infer<typeof createTripSchema>;

export type TripFormState =
  | {
      errors?: {
        name?: string[];
        start_date?: string[];
        end_date?: string[];
      };
      message?: string;
    }
  | undefined;

// Input schema for setting a trip's departure / return dates.
export const setTripDatesSchema = z
  .object({
    tripId: z.uuid(),
    start_date: isoDate("יש לבחור תאריך יציאה."),
    // Empty return date is allowed — the form sends null for a blank field.
    end_date: isoDate("תאריך חזרה לא תקין.").nullable().optional(),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    error: "תאריך החזרה חייב להיות באותו יום או אחרי היציאה.",
    path: ["end_date"],
  });
export type SetTripDatesInput = z.infer<typeof setTripDatesSchema>;

export type TripDatesFormState =
  | { ok?: boolean; error?: string }
  | undefined;

// Whole days from today until `startDate`: 0 = today, positive = future,
// negative = already departed. Compared in UTC date-only space to sidestep
// timezone drift.
export function daysUntil(startDate: string): number {
  const [y, m, d] = startDate.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

// Human, warm Hebrew phrasing for the countdown to departure.
export function formatCountdown(days: number): string {
  if (days < 0) return "הטיול יצא לדרך";
  if (days === 0) return "היום יוצאים!";
  if (days === 1) return "מחר יוצאים!";
  if (days === 2) return "עוד יומיים";
  return `עוד ${days} ימים`;
}

// The soonest trip whose departure is today or later — the "next trip" to
// feature on the home screen. Returns null when nothing is scheduled ahead.
export function pickUpcomingTrip(trips: Trip[]): Trip | null {
  let best: Trip | null = null;
  for (const t of trips) {
    if (!t.start_date || daysUntil(t.start_date) < 0) continue;
    if (!best || t.start_date < (best.start_date ?? "")) best = t;
  }
  return best;
}

// "14.9" — the departure date beside the countdown. Day and month only: the
// year is implied by the fact that the trip has not happened yet, and printing
// it makes the line read like a form field instead of a promise.
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(day)}.${Number(month)}`;
}

// There is no label map for `status` any more. The UI reads the phase derived
// from the trip's dates instead — see phaseLabel in ./trip-days and iron rule
// #6 in ARCHITECTURE.md. The column is still parsed above because it exists and
// is non-null, not because anything displays it.
