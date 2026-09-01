import { formatShortDate } from "./trip";
import { dateOfDay } from "./trip-days";
import type { Booking } from "./booking";
import type { ItineraryDay } from "./ai-suggestion";

// What is still open in a trip that has not left yet.
//
// The day screen used to have nothing to say before departure. It rendered the
// "now" card only when there is a day you are living, and the day pager only
// during or after the trip — so a trip leaving in 62 days drew a screen-reader
// heading and nothing else, and every piece of content on the screen was in the
// context pane beside an empty column.
//
// The honest answer to "what should this screen say two months out" is not the
// itinerary — that is what the days tab is for. It is the countdown, which the
// band above already carries, and **the list of things still to do**. This
// computes that list.
//
// Pure, and in the domain rather than in the component, for the usual reason:
// the ordering below is a product judgement about which unfinished thing blocks
// which, and that belongs somewhere it can be read and argued with rather than
// buried in JSX.
export type OpenItem = {
  id: string;
  text: string;
  // A second line, when the row is a count and the specifics are useful — which
  // days, which cities.
  detail: string | null;
  // "now" earns the warning colour. It means leaving this costs money or blocks
  // the next step; "later" means worth knowing. A screen where every row is
  // urgent has no urgent rows.
  urgency: "now" | "later";
  // Where the fix happens, as a path under /trips/[id].
  path: string;
};

// Missing lodging is not urgent two months out and is very urgent two weeks
// out, and the row should not have to pretend otherwise. Three weeks is the
// number the bookings step's own copy uses for trains ("מקומות נגמרים כשבועיים
// מראש"), rounded up so the warning arrives before the squeeze rather than
// during it.
const URGENT_WITHIN_DAYS = 21;

// Enough rows to be a list, few enough to be read. Past this the rows stop
// being "what to do next" and become an audit; the specifics move to a detail
// line instead — "3 ערים עדיין בלי לינה" says as much as three rows do.
const MAX_NAMED = 2;

export function tripOpenItems({
  startDate,
  daysUntilStart,
  dayCount,
  cities,
  itinerary,
  bookings,
}: {
  startDate: string | null;
  // Null when the trip has no start date, which is itself the first item below.
  daysUntilStart: number | null;
  dayCount: number;
  // The route, in visiting order.
  cities: string[];
  itinerary: ItineraryDay[];
  bookings: Booking[];
}): OpenItem[] {
  const items: OpenItem[] = [];
  const soon =
    daysUntilStart !== null && daysUntilStart <= URGENT_WITHIN_DAYS;

  // ---- the two things everything else derives from ------------------------
  // Dates first, and not because they are the first step in the guide: without
  // them there is no day count, no countdown and no forecast, so every other
  // row below either cannot be computed or cannot be acted on.
  if (!startDate) {
    items.push({
      id: "dates",
      text: "עוד לא נקבעו תאריכים לטיול",
      detail: "מספר הימים בלו״ז, הספירה לאחור והתחזית נגזרים מהם",
      urgency: "now",
      path: "more/trip",
    });
  }

  if (cities.length === 0) {
    items.push({
      id: "cities",
      text: "עוד אין יעדים בטיול",
      detail: "בחרו ערים ומקומות ב״מה עושים?״",
      urgency: "now",
      path: "explore",
    });

    // Nothing below this can be computed without a route, and a list that
    // repeats "you have no destinations" in four wordings is not a list.
    return items;
  }

  // ---- the itinerary -----------------------------------------------------
  if (itinerary.length === 0) {
    items.push({
      id: "itinerary",
      text: "הלו״ז עוד לא נבנה",
      detail: `${cities.length} ${cities.length === 1 ? "יעד מחכה" : "יעדים מחכים"} לשיבוץ לימים ולשעות`,
      urgency: "later",
      path: "days",
    });
  } else {
    const empty = itinerary.filter((day) => day.items.length === 0);
    if (empty.length > 0) {
      const dates = empty
        .map((day) => dateOfDay(startDate, day.day))
        .filter((date): date is string => date !== null)
        .map(formatShortDate);

      items.push({
        id: "empty-days",
        text:
          empty.length === 1
            ? "יום אחד בלו״ז בלי שום דבר"
            : `${empty.length} ימים בלו״ז בלי שום דבר`,
        detail: describeList(dates),
        urgency: "later",
        path: "days",
      });
    }
  }

  // ---- lodging -----------------------------------------------------------
  // By the city on the booking rather than by which itinerary day it covers.
  // A trip can be missing lodging before it has an itinerary at all, and that
  // is exactly the trip this screen is being fixed for.
  const booked = new Set(
    bookings
      .filter((booking) => booking.kind === "lodging" && booking.city)
      .map((booking) => booking.city as string),
  );
  const unlodged = cities.filter((city) => !booked.has(city));

  if (unlodged.length > 0) {
    items.push({
      id: "lodging",
      text:
        unlodged.length <= MAX_NAMED
          ? `${joinCities(unlodged)} עדיין בלי לינה`
          : `${unlodged.length} ערים עדיין בלי לינה`,
      detail: unlodged.length <= MAX_NAMED ? null : describeList(unlodged),
      urgency: soon ? "now" : "later",
      path: "more/trip",
    });
  }

  // ---- getting there ----------------------------------------------------
  // Only when there is nothing at all. "Which leg is unbooked" is not knowable:
  // the app has no notion of a planned-but-unbooked flight, and inventing one
  // from the route would flag a trip someone is deliberately driving.
  const hasTransport = bookings.some(
    (booking) => booking.kind === "flight" || booking.kind === "train",
  );
  if (!hasTransport) {
    items.push({
      id: "transport",
      text: "אין טיסה או רכבת בטיול",
      detail: "הלו״ז מסתמך עליהן כדי לדעת מתי בדיוק אתם מגיעים",
      urgency: soon ? "now" : "later",
      path: "more/trip",
    });
  }

  // ---- days the itinerary does not cover --------------------------------
  // The itinerary being shorter than the trip is different from a day inside it
  // being empty: those days do not exist in the plan at all.
  if (dayCount > 0 && itinerary.length > 0 && itinerary.length < dayCount) {
    const uncovered = dayCount - itinerary.length;
    items.push({
      id: "short-itinerary",
      text: `הלו״ז קצר מהטיול ב-${uncovered} ${uncovered === 1 ? "יום" : "ימים"}`,
      detail: "בנייה מחדש תפרוס אותו על כל הימים",
      urgency: "later",
      path: "days",
    });
  }

  return items;
}

// "18.09, 21.09 ועוד 2" — three named and the rest counted, which is the same
// shape the trip band uses for its city chips.
function describeList(values: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length <= 3) return joinCities(values);
  return `${values.slice(0, 3).join(", ")} ועוד ${values.length - 3}`;
}

function joinCities(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} ו${values[values.length - 1]}`;
}
