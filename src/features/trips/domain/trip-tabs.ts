// The five things a traveller needs, in the order they need them.
//
// The old tabs were named after the features that built them — "לוגיסטיקה",
// "מילים שימושיות" — which is a table of contents for the codebase, not for a
// trip. These are named after the question being asked.
//
// Written in reading order. Under dir="rtl" a flex row puts the first entry on
// the right, which is where a Hebrew reader starts.
export const TRIP_TABS = [
  { segment: "today", label: "היום" },
  { segment: "days", label: "ימים" },
  { segment: "explore", label: "מה עושים?" },
  { segment: "map", label: "מפה" },
  { segment: "more", label: "עוד" },
] as const;

export type TripTabSegment = (typeof TRIP_TABS)[number]["segment"];

export function tripTabHref(tripId: string, segment: TripTabSegment) {
  return `/trips/${tripId}/${segment}`;
}

// Where a trip opens. A trip with no departure date is still being planned, so
// it lands on discovery; anything else lands on the day view.
//
// This was written expecting tripPhase to replace it. It should not: tripPhase
// returns "undated" exactly when start_date is null, so routing on the phase
// gives the same two answers while costing the redirect a day-count query. The
// day view already handles before/during/after itself once you are there.
export function defaultTripTab(startDate: string | null): TripTabSegment {
  return startDate ? "today" : "explore";
}
