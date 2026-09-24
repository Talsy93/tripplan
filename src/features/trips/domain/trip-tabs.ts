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
  // v6 (Stitch): the four tabs of the design. "עוזר AI" is the design's chat
  // screen — the conversation with its plan cards — at /ai. The planning
  // screen (search, categories, discovery) is still at /explore, reached from
  // "הוסף יעד" on the itinerary and from the assistant; it is no longer a tab.
  { segment: "days", label: "מסלול" },
  // The swipe deck (design/stitch/…/discover_page, 2026-09-24).
  { segment: "discover", label: "גילוי" },
  { segment: "ai", label: "עוזר AI" },
  { segment: "more", label: "מסמכים" },
] as const;

export type TripTabSegment = (typeof TRIP_TABS)[number]["segment"];

// Every top-level screen of a trip, tab or not.
export type TripSection = TripTabSegment | "explore";

// The tabs, each with whether it can be pressed yet. `live` is "the trip has
// started and has not finished" — the only state in which a "today" exists.
//
// Shown-but-dead rather than absent, on second thought and on request: "add it
// back small and not pressable, so the user understands this tab opens the
// moment the trip starts." Which is the better answer than hiding it. A tab
// that disappears and reappears is an app that changed shape; a tab that is
// visibly waiting is an app that told you what is coming. It costs one row of
// muted text and removes the only surprise in the navigation.
export function tripTabsFor(
  live: boolean,
): readonly { segment: TripTabSegment; label: string; waiting: boolean }[] {
  return TRIP_TABS.map((tab) => ({
    segment: tab.segment,
    label: tab.label,
    waiting: "onlyDuringTrip" in tab && !live,
  }));
}

export function tripTabHref(tripId: string, segment: TripSection) {
  return `/trips/${tripId}/${segment}`;
}

// Where a trip opens: the schedule, always.
//
// It used to be "today" for a dated trip and "planning" for one without dates,
// which made opening a trip a small guess about what you came for. Asked for
// directly — "entering a trip, the main page should go to the schedule" — and
// it is the right default whichever phase the trip is in: before, the schedule
// is what you are building; during, it is what you are following; after, it is
// what happened. "היום" is one press away for the days it exists, and the
// planning tab is where you go to add something rather than to look.
//
// It takes nothing now. The date was the only input and there is no longer a
// branch to feed, and a parameter that is accepted and ignored is a signature
// that says a decision is being made here when none is.
export function defaultTripTab(): TripTabSegment {
  return "days";
}
