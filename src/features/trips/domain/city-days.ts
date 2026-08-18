import * as z from "zod";
import { bookingNights } from "./booking";
import type { Booking } from "./booking";

// How many days the trip spends in each city — the number the itinerary builder
// was missing entirely.
//
// Before this, the prompt sent a flat list of items and asked the model to
// "arrange them into days", so the split between cities was a side effect of the
// model's answer, and the days/nights shown in the app were read back out of it.
// A hotel booked for three nights in Rome had no influence at all.
//
// The order of preference is deliberate:
//
//   1. an explicit override the user typed          — they said it, it wins
//   2. the nights they have booked, plus one        — they paid for it
//   3. nothing                                     — the model may decide
//
// Booked nights become days by adding one, because a night is the gap between
// two days: check in on the 4th and out on the 7th is three nights and four days
// in that city. This is the same rule domain/route.ts already applies in the
// other direction when it reports nights from an itinerary.

export const cityDaysSchema = z.object({
  trip_id: z.uuid(),
  city: z.string(),
  days: z.number().int(),
  updated_at: z.string(),
});
export type CityDays = z.infer<typeof cityDaysSchema>;

export const setCityDaysSchema = z.object({
  city: z.string().trim().min(1, "צריך לבחור עיר"),
  // Null clears the override and hands the city back to the booking, or to the
  // model when there is no booking. The form sends an empty field for that.
  days: z
    .number()
    .int("מספר הימים צריך להיות מספר שלם")
    .min(1, "לפחות יום אחד")
    .max(60, "עד 60 ימים")
    .nullable(),
});
export type SetCityDaysInput = z.infer<typeof setCityDaysSchema>;

export type CityDayPlan = {
  city: string;
  days: number | null;
  source: "override" | "lodging" | "unset";
};

// Nights per city from the lodging bookings alone.
//
// Summed rather than taken from the longest stay: a city can hold two
// consecutive hotels, and in that case the trip is there for both. Overlapping
// stays are the double-booking case, which doubleBookedLodgingIds already
// reports separately — summing them overstates the city by design, because the
// honest answer is "you have not decided yet" and the warning already says so.
//
// One caveat, found while testing this: bookingNights counts calendar days in
// the *runtime's* local zone, so a stay that crosses local midnight is a night
// (correctly — 18:00 to 01:00 is one night) but the boundary moves with the
// zone. Vercel runs UTC and the browser does not, so the plan is computed once
// on the server and passed down as a value rather than recomputed in the client.
// That is the same discipline domain/trip-days.ts already applies to `today`.
function bookedNightsByCity(bookings: Booking[]): Map<string, number> {
  const nights = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.kind !== "lodging") continue;
    const city = booking.city?.trim();
    if (!city) continue;

    const n = bookingNights(booking);
    if (n === null) continue;

    nights.set(city, (nights.get(city) ?? 0) + n);
  }

  return nights;
}

// The plan for every city the trip knows about, in the order given.
//
// `cities` drives the result rather than the bookings or the overrides: a city
// with neither still has to appear, because "no answer yet" is the thing the UI
// most needs to show.
export function cityDayPlan(
  cities: string[],
  bookings: Booking[],
  overrides: CityDays[],
): CityDayPlan[] {
  const booked = bookedNightsByCity(bookings);
  const override = new Map(overrides.map((row) => [row.city, row.days]));

  return cities.map((city) => {
    const explicit = override.get(city);
    if (explicit !== undefined) {
      return { city, days: explicit, source: "override" as const };
    }

    const nights = booked.get(city);
    if (nights !== undefined && nights > 0) {
      // A night is the gap between two days, so N nights covers N+1 days.
      return { city, days: nights + 1, source: "lodging" as const };
    }

    return { city, days: null, source: "unset" as const };
  });
}

// The total the plan accounts for, and whether it fits the trip's own dates.
//
// Returns null for `plannedDays` when nothing is decided anywhere, so the UI can
// tell "0 days planned" apart from "nobody has said anything yet".
export function cityDayTotals(
  plan: CityDayPlan[],
  tripDayCount: number | null,
) {
  const decided = plan.filter((entry) => entry.days !== null);
  const plannedDays = decided.reduce((sum, entry) => sum + (entry.days ?? 0), 0);

  return {
    plannedDays: decided.length > 0 ? plannedDays : null,
    undecidedCities: plan.filter((entry) => entry.days === null).length,
    // Positive when the cities ask for more days than the dates allow. Reported
    // rather than clamped, the same way itineraryOverrun is — silently shrinking
    // a city would hide the conflict the user needs to resolve.
    overBy:
      tripDayCount !== null && decided.length > 0 && plannedDays > tripDayCount
        ? plannedDays - tripDayCount
        : 0,
  };
}

// The line the itinerary prompt gets. Only decided cities appear: telling the
// model "Florence: unknown" invites it to invent a number, while leaving Florence
// out lets it use the freedom it already has for whatever days are left over.
export function cityDaysPromptLine(plan: CityDayPlan[]): string | null {
  const decided = plan.filter((entry) => entry.days !== null);
  if (decided.length === 0) return null;

  return decided
    .map((entry) => `${entry.city}: ${entry.days} ימים`)
    .join(", ");
}
