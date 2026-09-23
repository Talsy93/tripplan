// The five things a traveller needs, in the order they need them.
//
// The old tabs were named after the features that built them — "לוגיסטיקה",
// "מילים שימושיות" — which is a table of contents for the codebase, not for a
// trip. These are named after the question being asked.
//
// Written in reading order. Under dir="rtl" a flex row puts the first entry on
// the right, which is where a Hebrew reader starts.
// "ימים" became "לו״ז" and "יעדים" became "תכנון" on request, and both are
// better names for the reason the tabs were renamed the first time: they say
// what you do there rather than what is listed there. The middle tab is not a
// list of days, it is the schedule; the third is not a list of destinations,
// it is where the trip gets planned.
export const TRIP_TABS = [
  {
    segment: "today",
    label: "היום",
    // There is no "today" until the trip starts.
    //
    // Before then this tab was the preparations screen — a countdown, the prep
    // checklist, what is still open — which is a list page wearing the name of
    // a day, and the app already has a list page. So the tab is not drawn
    // until the trip is on, and /today sends you to the lists in the meantime.
    // The route is untouched: a bookmark or a shared link still resolves.
    onlyDuringTrip: true,
  },
  { segment: "days", label: 'לו"ז' },
  { segment: "explore", label: "תכנון" },
  { segment: "more", label: "עוד" },
] as const;

export type TripTabSegment = (typeof TRIP_TABS)[number]["segment"];

// The tabs actually drawn. `live` is "the trip has started and has not
// finished" — the only state in which a "today" exists.
export function visibleTripTabs(
  live: boolean,
): readonly { segment: TripTabSegment; label: string }[] {
  return TRIP_TABS.filter((tab) => live || !("onlyDuringTrip" in tab));
}

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
