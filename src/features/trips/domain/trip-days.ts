import { addDays, daysBetween, weekdayLabel } from "./weather";
import type { Booking } from "./booking";

// Where a trip is in time, and which calendar date each itinerary day falls on.
//
// The itinerary has never had dates — `itinerary_items` stores `day_number`
// (1, 2, 3…) and free-text time labels, and the timestamp columns from
// migration 0002 were never written. That was deliberate: a trip can exist
// without dates at all. So the date is *derived* here rather than stored, and
// there is no migration.
//
// Every function takes `today` as a parameter and none reads the clock. That
// keeps them pure, and it is what lets a server render and a client render
// agree — see todayIn/APP_TIME_ZONE in ./weather.

export type TripPhase =
  | { kind: "undated" }
  // Always >= 1: departure day itself is "during".
  | { kind: "before"; daysUntilStart: number }
  | { kind: "during"; dayNumber: number }
  | { kind: "after"; daysSinceEnd: number };

// The last date the trip covers. `end_date` decides when it is set; otherwise
// the itinerary's own length does, and a trip with neither is a single day.
function effectiveEnd(
  startDate: string,
  endDate: string | null,
  dayCount: number,
): string {
  if (endDate && endDate >= startDate) return endDate;
  return addDays(startDate, Math.max(dayCount, 1) - 1);
}

export function tripPhase(
  startDate: string | null,
  endDate: string | null,
  today: string,
  dayCount: number,
): TripPhase {
  if (!startDate) return { kind: "undated" };

  const untilStart = daysBetween(today, startDate);
  if (untilStart > 0) return { kind: "before", daysUntilStart: untilStart };

  const end = effectiveEnd(startDate, endDate, dayCount);
  const sinceEnd = daysBetween(end, today);
  if (sinceEnd > 0) return { kind: "after", daysSinceEnd: sinceEnd };

  // Day 1 is the departure date, so the offset is 1-based.
  return { kind: "during", dayNumber: daysBetween(startDate, today) + 1 };
}

// The calendar date of itinerary day N (1-based).
//
// Null for a dateless trip: day numbers are legitimate without dates, and
// inventing one would be worse than showing "יום 3" on its own.
export function dateOfDay(
  startDate: string | null,
  dayNumber: number,
): string | null {
  if (!startDate || dayNumber < 1) return null;
  return addDays(startDate, dayNumber - 1);
}

export function dayNumberOfDate(
  startDate: string | null,
  date: string,
  dayCount: number,
): number | null {
  if (!startDate) return null;
  const day = daysBetween(startDate, date) + 1;
  return day >= 1 && day <= dayCount ? day : null;
}

export function currentDayNumber(
  startDate: string | null,
  today: string,
  dayCount: number,
): number | null {
  return dayNumberOfDate(startDate, today, dayCount);
}

export function clampDay(dayNumber: number, dayCount: number): number {
  if (dayCount < 1) return 1;
  return Math.min(Math.max(dayNumber, 1), dayCount);
}

// Which day the "today" tab opens on. Before the trip that is day 1, after it
// the last day, and during it the day you are actually living.
//
// Null only when there is no itinerary at all — the caller shows the empty
// state rather than an empty day.
export function focusDayNumber(
  phase: TripPhase,
  dayCount: number,
): number | null {
  if (dayCount < 1) return null;
  if (phase.kind === "during") return clampDay(phase.dayNumber, dayCount);
  if (phase.kind === "after") return dayCount;
  return 1;
}

// How many days the itinerary runs past the booked return date. 0 when it
// fits, null when either date is missing.
//
// Deliberately reported rather than clamped: an itinerary longer than the trip
// is a real planning mistake, and hiding it would make two days share a date.
export function itineraryOverrun(
  startDate: string | null,
  endDate: string | null,
  dayCount: number,
): number | null {
  if (!startDate || !endDate || dayCount < 1) return null;
  const lastItineraryDate = addDays(startDate, dayCount - 1);
  const over = daysBetween(endDate, lastItineraryDate);
  return over > 0 ? over : 0;
}

// he-IL's short weekday is "יום ד׳", which reads as "יום 3 · יום ד׳" once it
// follows a day number. Dropping the prefix is only correct next to the word
// "יום", so it happens here rather than inside weekdayLabel — the forecast
// shows the weekday on its own and wants it.
function weekdayAfterDayNumber(date: string): string {
  return weekdayLabel(date).replace(/^יום\s+/, "");
}

// "יום 3 · ג׳, 14.08", or just "יום 3" when the trip has no dates.
export function dayLabel(dayNumber: number, date: string | null): string {
  return date
    ? `יום ${dayNumber} · ${weekdayAfterDayNumber(date)}`
    : `יום ${dayNumber}`;
}

// "יום 3 מתוך 9 · ג׳, 14.08" — the day view's subtitle, where the total
// matters as much as the number.
export function dayOfTripLabel(
  dayNumber: number,
  dayCount: number,
  date: string | null,
): string {
  const base = `יום ${dayNumber} מתוך ${dayCount}`;
  return date ? `${base} · ${weekdayAfterDayNumber(date)}` : base;
}

// Bookings grouped by the itinerary day they fall on.
//
// Bookings are the only rows in the project with a real timestamp, so this is
// the one place a day's contents are known rather than inferred. `zone` is
// passed in for the same reason `today` is elsewhere: the day a 23:40 flight
// belongs to depends on whose calendar you ask.
export function bookingsByDay(
  bookings: Booking[],
  startDate: string | null,
  dayCount: number,
  zone: string,
): Map<number, Booking[]> {
  const byDay = new Map<number, Booking[]>();
  if (!startDate) return byDay;

  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone });

  for (const booking of bookings) {
    const at = new Date(booking.starts_at);
    if (Number.isNaN(at.getTime())) continue;

    const day = dayNumberOfDate(startDate, formatter.format(at), dayCount);
    if (day === null) continue;

    const list = byDay.get(day) ?? [];
    list.push(booking);
    byDay.set(day, list);
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  return byDay;
}

// ---- Where you sleep ------------------------------------------------------

export type NightLodging = {
  booking: Booking;
  // The night you arrive — the day that also carries a check-in time.
  isCheckIn: boolean;
  // The last night of this booking; the following morning you check out.
  isLastNight: boolean;
};

// The lodging that covers each itinerary day's night.
//
// Distinct from bookingsByDay above, which buckets every booking by its
// `starts_at` alone. That answers "what happens today", so a hotel booked for
// five nights shows up on the check-in day and nowhere else — and "where am I
// sleeping on day 4" had no answer at all.
//
// A booking with check-in X and check-out Y covers the nights of X..Y-1: on the
// morning of Y you leave, so that date gets no lodging. Dates are compared as
// YYYY-MM-DD strings, which sort correctly, and are resolved in `zone` for the
// same reason bookingsByDay takes one — a 23:40 check-in belongs to a different
// date depending on whose calendar you ask.
export function lodgingByDay(
  bookings: Booking[],
  startDate: string | null,
  dayCount: number,
  zone: string,
): Map<number, NightLodging> {
  const byDay = new Map<number, NightLodging>();
  if (!startDate || dayCount < 1) return byDay;

  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone });
  const dateOf = (iso: string): string | null => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? null : formatter.format(at);
  };

  const stays: { booking: Booking; checkIn: string; checkOut: string | null }[] =
    [];
  for (const booking of bookings) {
    if (booking.kind !== "lodging") continue;
    const checkIn = dateOf(booking.starts_at);
    if (!checkIn) continue;
    const checkOut = booking.ends_at ? dateOf(booking.ends_at) : null;
    // A check-out that is not after the check-in tells us nothing about later
    // nights, so it is treated as unknown rather than as a negative span.
    stays.push({
      booking,
      checkIn,
      checkOut: checkOut && checkOut > checkIn ? checkOut : null,
    });
  }
  if (stays.length === 0) return byDay;

  for (let day = 1; day <= dayCount; day += 1) {
    const date = addDays(startDate, day - 1);

    // Without a check-out date we only know about the night of arrival.
    // Assuming the stay continues would invent nights the user never entered —
    // and would be wrong the moment they booked a second hotel.
    const covering = stays.filter((stay) =>
      stay.checkOut
        ? stay.checkIn <= date && date < stay.checkOut
        : stay.checkIn === date,
    );
    if (covering.length === 0) continue;

    // Overlapping stays are a data conflict, not a scenario to average: the
    // most recent check-in is where you actually went to sleep.
    const chosen = covering.reduce((best, stay) =>
      stay.checkIn > best.checkIn ||
      (stay.checkIn === best.checkIn &&
        stay.booking.starts_at > best.booking.starts_at)
        ? stay
        : best,
    );

    byDay.set(day, {
      booking: chosen.booking,
      isCheckIn: date === chosen.checkIn,
      isLastNight: chosen.checkOut
        ? addDays(date, 1) === chosen.checkOut
        : true,
    });
  }

  return byDay;
}

// How to describe a night, given where it falls in the stay. Kept next to
// lodgingByDay rather than in the component, for the same reason dayLabel is
// here: the wording is a property of the data, not of the screen.
export function nightStayLabel(stay: NightLodging): string {
  if (stay.isCheckIn && stay.isLastNight) return "לילה אחד כאן";
  if (stay.isCheckIn) return "צ׳ק-אין";
  if (stay.isLastNight) return "הלילה האחרון כאן";
  return "ישנים כאן";
}

// Replaces tripStatusLabels in the UI. The stored status could not tell you
// this: it was set to 'executing' the moment an itinerary was generated,
// possibly months before departure, and never reached 'completed'.
export function phaseLabel(phase: TripPhase): string {
  switch (phase.kind) {
    case "undated":
      return "בתכנון";
    case "before":
      return phase.daysUntilStart === 1 ? "יוצאים מחר" : "לפני היציאה";
    case "during":
      return "בטיול";
    case "after":
      return "הסתיים";
  }
}
