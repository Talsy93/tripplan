import { tripPhase } from "./trip-days";
import type { TripPhase } from "./trip-days";
import type { Trip } from "./trip";

// What the home screen shows first, and in what order.
//
// This exists because the screen used to answer both questions with
// `pickUpcomingTrip`, which returns exactly one trip — the earliest start date
// still in the future — and because everything it did not return was rendered
// as an identical small card in creation order. Two consequences, both wrong:
//
//   * **A trip you are actually on was excluded.** The filter was
//     `daysUntil(start) < 0 → skip`, and a trip that has already left is
//     exactly that. So while travelling, the screen featured the *next* trip
//     and the one being lived sat in the grid like any other. The trip you are
//     on is the most relevant thing the app can show; it now sorts first and
//     takes the hero.
//   * **Creation order is not proximity.** `listTrips` orders by `created_at`
//     descending, which is when you thought of the trip rather than when it
//     happens. A trip booked last year and leaving on Sunday sat below one
//     invented yesterday for next summer.
//
// Phase-derived throughout, per iron rule #6: nothing here reads `status`.

// Ordering is by band first, then within the band. The bands are declared
// rather than inferred so the intent survives someone adding a phase later.
//
//   0  during    the trip being lived — there is at most one that matters, and
//                if two overlap the one that started later is the current one
//   1  before    ahead, nearest departure first
//   2  undated   planned, no dates yet; still real, just not on the calendar
//   3  after     finished, most recently finished first
//
// "after" last and "undated" above it was a choice: a trip with no dates is
// something you are still going to do, and a finished one is a record. Both
// stay on screen — hiding trips is what the archive did before it was removed.
const BAND: Record<TripPhase["kind"], number> = {
  during: 0,
  before: 1,
  undated: 2,
  after: 3,
};

export type StandingTrip = {
  trip: Trip;
  phase: TripPhase;
};

// `dayCounts` is how long each trip's itinerary runs, and leaving it out is
// survivable rather than free: `tripPhase` needs it to place a trip that has a
// start date and no end date, and without it such a trip reads as a single day
// — so the day after departure it becomes "finished" while you are standing in
// the airport. The home screen passes real counts for exactly this reason; a
// caller that has none (the compact list) gets the old approximation.
export function orderTripsByProximity(
  trips: Trip[],
  today: string,
  dayCounts?: Map<string, number>,
): StandingTrip[] {
  const standing = trips.map((trip) => ({
    trip,
    phase: tripPhase(
      trip.start_date,
      trip.end_date,
      today,
      dayCounts?.get(trip.id) ?? 0,
    ),
  }));

  // Sorted on a copy of the input's order, and `sort` is stable in every engine
  // this runs on, so trips that tie — two undated ones, two leaving the same
  // day — keep the creation order they arrived in.
  return standing.sort((a, b) => {
    const band = BAND[a.phase.kind] - BAND[b.phase.kind];
    if (band !== 0) return band;

    if (a.phase.kind === "before" && b.phase.kind === "before") {
      return a.phase.daysUntilStart - b.phase.daysUntilStart;
    }
    if (a.phase.kind === "after" && b.phase.kind === "after") {
      return a.phase.daysSinceEnd - b.phase.daysSinceEnd;
    }
    if (a.phase.kind === "during" && b.phase.kind === "during") {
      // Two trips overlapping today is a data mistake rather than a state to
      // design for, but it has to resolve to something: the lower day number is
      // the one that started more recently, and that is the likelier subject.
      return a.phase.dayNumber - b.phase.dayNumber;
    }
    return 0;
  });
}

// The trip the screen is about: the one being lived, or else the next one out.
//
// Replaces pickUpcomingTrip for the hero. The difference that matters is the
// first line — an active trip wins over every future one, however near.
export function pickFeaturedTrip(
  ordered: StandingTrip[],
): StandingTrip | null {
  for (const entry of ordered) {
    if (entry.phase.kind === "during" || entry.phase.kind === "before") {
      return entry;
    }
  }
  // Nothing scheduled. Rather than nothing at all, the most recent trip is
  // still the screen's subject — but the caller decides whether a finished trip
  // deserves the hero, and today it does not. Returning null keeps that policy
  // in one place.
  return null;
}

// The line under a trip's name: where it stands, in words.
//
// `phaseLabel` says "לפני היציאה", which is a state and not an answer to the
// question the screen is actually asked — how long until this happens. The
// countdown phrasing already existed in formatCountdown and nothing in the list
// was calling it.
export function standingLabel(phase: TripPhase): string {
  switch (phase.kind) {
    case "during":
      // Departure day is day 1 of "during", not the last day of "before" —
      // tripPhase draws the line that way, so "היום יוצאים!" belongs here or it
      // is unreachable. formatCountdown still holds this string for a caller
      // working from a raw day offset; the two must not drift apart.
      return phase.dayNumber === 1 ? "היום יוצאים!" : `יום ${phase.dayNumber} בטיול`;
    case "before":
      if (phase.daysUntilStart === 1) return "מחר יוצאים!";
      if (phase.daysUntilStart === 2) return "עוד יומיים";
      return `עוד ${phase.daysUntilStart} ימים`;
    case "undated":
      return "בתכנון · אין תאריכים";
    case "after":
      if (phase.daysSinceEnd === 1) return "הסתיים אתמול";
      return `הסתיים לפני ${phase.daysSinceEnd} ימים`;
  }
}
