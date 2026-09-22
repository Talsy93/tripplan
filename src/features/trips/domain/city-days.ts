import * as z from "zod";
import { isStandby, lodgingNights } from "./booking";
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
// **Distinct nights, not summed stays**, and that is the whole point of this
// function. Reported: a double lodging was counting its days twice. Two rooms
// over the same weekend in Rome is still one weekend in Rome — you cannot sleep
// in both — so the city needs the days it needs, whatever was booked to cover
// them.
//
// So each stay contributes the set of dates it covers and the city keeps the
// union. Two consecutive hotels still add up, because their dates do not
// overlap; two overlapping ones no longer do, because theirs do. There is no
// rule here about overlaps at all, which is why it cannot get one of them
// wrong: it counts nights, and a night is a night.
//
// This replaces summing `bookingNights`, which produced "the cities want 52 days
// but your dates give 43" on a trip whose real answer was 43. 0022 had already
// taken one bite out of that by letting the traveller mark a held room as
// standby; the skip below stays, because standby says "this one is going to be
// cancelled" and that is a statement about the booking rather than about the
// nights. But it is no longer load-bearing — an unmarked double no longer
// inflates anything, so nobody has to know about the flag for the number to
// come out right.
//
// Dates in `zone` rather than the runtime's, which is the caveat the old
// version carried: Vercel runs UTC and the browser does not, so counting
// calendar days locally moved the boundary with the machine. Passing the zone
// in is the same discipline domain/trip-days.ts already applies to `today`.
function bookedNightsByCity(
  bookings: Booking[],
  zone: string,
): Map<string, number> {
  const nightsByCity = new Map<string, Set<string>>();

  for (const booking of bookings) {
    if (booking.kind !== "lodging") continue;
    if (isStandby(booking)) continue;
    const city = booking.city?.trim();
    if (!city) continue;

    const nights = lodgingNights(booking, zone);
    if (nights.length === 0) continue;

    let held = nightsByCity.get(city);
    if (!held) {
      held = new Set<string>();
      nightsByCity.set(city, held);
    }
    for (const night of nights) held.add(night);
  }

  return new Map(
    [...nightsByCity].map(([city, nights]) => [city, nights.size]),
  );
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
  // The calendar the nights are counted on. Required rather than defaulted:
  // a default would be the runtime's zone, which is the bug this parameter
  // exists to close.
  zone: string,
): CityDayPlan[] {
  const booked = bookedNightsByCity(bookings, zone);
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
