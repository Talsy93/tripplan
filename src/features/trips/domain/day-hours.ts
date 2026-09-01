import { BOOKING_KINDS } from "./booking";
import { addDays } from "./weather";
import { formatMinutes } from "./timeline";
import type { AiItinerary } from "./ai-suggestion";
import type { Booking } from "./booking";

// The hours of a day that are actually free to plan in.
//
// `buildDayCityPlan` answers "which city is day N in", which is what stopped the
// model putting a Kyoto restaurant on a Rome day. It says nothing about *time*,
// and the prompt said nothing either — so the model planned 09:00 to 18:00 on
// every day of the trip, including the day the traveller was still on a plane
// until 14:00 and checked into the hotel at 15:00.
//
// Reported exactly that way: "it makes no sense that my check-in is at one hour
// and there is something in the schedule at an hour before it".
//
// Bookings are the only rows in this project with a real timestamp, so they are
// the only thing that can answer this. Same reasoning as the lodging lines in the
// itinerary prompt: a booking was paid for, which makes it the strongest
// statement of intent the app has.

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// How long after landing you are actually free. Immigration, baggage and the
// ride into town — 90 minutes is short for a big international airport and
// generous for a domestic hop, and erring short is the safer direction here:
// this only ever moves a planned item later, and moving it too far would delete
// a usable afternoon.
const ARRIVAL_BUFFER_MIN = 90;

// How long before departure you have to have stopped. Per kind, because "be
// there three hours early" is a flight rule and applying it to a train would
// throw away an afternoon in Kyoto.
const DEPARTURE_BUFFER_MIN: Record<string, number> = {
  flight: 180,
  train: 45,
};
const DEFAULT_DEPARTURE_BUFFER_MIN = 60;

// Past this, an arrival stops being the start of anything. 21:00 is chosen so
// that landing at 19:00 still leaves a dinner worth planning and landing at
// 21:00 does not pretend to.
const LATEST_USEFUL_START = 21 * MINUTES_PER_HOUR;

export type DayHours = {
  day: number;
  date: string;
  // Minutes from local midnight. Null means "nothing constrains this end of the
  // day" — which is most days, and is different from a default of 08:00: a
  // default would be this module inventing a constraint the bookings do not
  // support, and the reconcile below enforces whatever is here.
  earliest: number | null;
  latest: number | null;
  // Human phrases naming the booking behind each bound, for the prompt. Kept
  // beside the numbers because a constraint the model is given without a reason
  // is one it feels free to round off.
  reasons: string[];
};

// Local wall-clock minutes of an instant, in `zone`.
function minutesInZone(iso: string, zone: string): number | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = value("hour") % 24;
  const minute = value("minute");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * MINUTES_PER_HOUR + minute;
}

function dateInZone(iso: string, zone: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(at);
}

export function buildDayHours(
  startDate: string,
  dayCount: number,
  bookings: Booking[],
  zone: string,
): DayHours[] {
  const out: DayHours[] = [];

  for (let day = 1; day <= dayCount; day += 1) {
    const date = addDays(startDate, day - 1);
    let earliest: number | null = null;
    let latest: number | null = null;
    // Tracked per bound rather than as one list, because a bound can be dropped
    // below and its reason has to go with it. The first version kept a flat
    // array, and the prompt line for the reported case read "arrival at 14:00;
    // departure at 05:00; check-in at 15:00" — naming a departure bound that had
    // already been discarded, on the same flight that did the arriving.
    let earliestReason: string | null = null;
    let latestReason: string | null = null;

    for (const booking of bookings) {
      const kind = BOOKING_KINDS[booking.kind];

      if (kind.isTransport) {
        // Arriving today: nothing before you are off the plane and out.
        if (booking.ends_at && dateInZone(booking.ends_at, zone) === date) {
          const at = minutesInZone(booking.ends_at, zone);
          if (at !== null) {
            const free = Math.min(at + ARRIVAL_BUFFER_MIN, MINUTES_PER_DAY - 1);
            if (earliest === null || free > earliest) {
              earliest = free;
              earliestReason = `הגעה ב-${formatMinutes(at)} (${booking.title})`;
            }
          }
        }

        // Leaving today: nothing after you have to be at the gate.
        if (dateInZone(booking.starts_at, zone) === date) {
          const at = minutesInZone(booking.starts_at, zone);
          if (at !== null) {
            const buffer =
              DEPARTURE_BUFFER_MIN[booking.kind] ??
              DEFAULT_DEPARTURE_BUFFER_MIN;
            const stop = Math.max(at - buffer, 0);
            if (latest === null || stop < latest) {
              latest = stop;
              latestReason = `יציאה ב-${formatMinutes(at)} (${booking.title})`;
            }
          }
        }

        continue;
      }

      // Lodging. Check-in only — check-out is a morning you still have, so
      // constraining it would delete the last half-day of every city.
      //
      // Treating check-in as a floor is the owner's call, not a derivation: you
      // can drop bags and go out before it. The cost is a morning on a day you
      // land early and check in late; the benefit is that the reported case —
      // check-in as the first thing that happens, with an activity planned
      // before it — cannot recur. Recorded here rather than argued in a commit.
      if (dateInZone(booking.starts_at, zone) === date) {
        const at = minutesInZone(booking.starts_at, zone);
        if (at !== null && (earliest === null || at > earliest)) {
          earliest = at;
          earliestReason = `צ׳ק-אין ב-${formatMinutes(at)} (${booking.title})`;
        }
      }
    }

    // An arrival this late leaves no evening to plan in, so it is not a start —
    // it is the end of a travel day. Recording it as a floor is actively wrong
    // on a same-day transfer: a 19:45 train arriving 21:00 would set the day's
    // earliest to 22:30 and, by the crossing rule below, throw away the
    // departure bound — turning a full day in the city you are leaving into a
    // day that begins at half past ten at night.
    //
    // Measured on exactly that case: latest came back null and the whole day
    // was mis-described.
    if (earliest !== null && earliest > LATEST_USEFUL_START) {
      earliest = null;
      earliestReason = null;
    }

    // Still possible to cross: a flight out before the morning's arrival buffer
    // clears. The arrival wins — it is a fact about where the traveller is, and
    // the departure bound is only advice about when to stop.
    if (earliest !== null && latest !== null && latest <= earliest) {
      latest = null;
      latestReason = null;
    }

    out.push({
      day,
      date,
      earliest,
      latest,
      reasons: [earliestReason, latestReason].filter(
        (reason): reason is string => reason !== null,
      ),
    });
  }

  return out;
}

// True when anything here is worth putting in a prompt.
export function dayHoursHaveFacts(hours: DayHours[]): boolean {
  return hours.some((day) => day.earliest !== null || day.latest !== null);
}

// The constrained days, as instructions.
export function dayHoursPromptLines(hours: DayHours[]): string {
  return hours
    .filter((day) => day.earliest !== null || day.latest !== null)
    .map((day) => {
      const bounds: string[] = [];
      if (day.earliest !== null) {
        bounds.push(`אל תתכננו כלום לפני ${formatMinutes(day.earliest)}`);
      }
      if (day.latest !== null) {
        bounds.push(`אל תתכננו כלום אחרי ${formatMinutes(day.latest)}`);
      }
      return `- יום ${day.day} (${day.date}): ${bounds.join(", ")} — ${day.reasons.join("; ")}`;
    })
    .join("\n");
}

// Moves anything the model scheduled before a day's earliest free minute.
//
// Enforced rather than trusted, for the reason reconcileItineraryWithDayPlan is:
// the prompt states the constraint and the model rounds it off. Same shape as
// that function too — it takes the plan, returns a corrected itinerary, and
// returns the input untouched when there is nothing to check against.
//
// Only the `earliest` bound is enforced. Shifting forward has one obvious
// target; shifting *backwards* to respect a departure does not — fitting five
// items into the two hours before a flight is a scheduling problem, not a
// correction, and the honest options there are to drop an item the user chose or
// to overlap it. The bound is in the prompt, where the model can act on it.
export function clampItineraryToDayHours(
  itinerary: AiItinerary,
  hours: DayHours[] | null,
): AiItinerary {
  if (!hours || hours.length === 0) return itinerary;

  const earliestByDay = new Map(
    hours
      .filter((day) => day.earliest !== null)
      .map((day) => [day.day, day.earliest as number]),
  );
  if (earliestByDay.size === 0) return itinerary;

  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      const floor = earliestByDay.get(day.day);
      if (floor === undefined) return day;

      // Sorted, so the cascade below only ever has to look at the previous item.
      // An unparseable time sorts to the front and is left alone: it is the
      // model returning something that is not a clock, and inventing an hour for
      // it would be worse than leaving it where the user can see the problem.
      const sorted = [...day.items].sort(
        (a, b) =>
          (parseClock(a.start_time) ?? -1) - (parseClock(b.start_time) ?? -1),
      );

      let previousEnd: number | null = null;
      const items = sorted.map((item) => {
        const start = parseClock(item.start_time);
        const end = parseClock(item.end_time);
        if (start === null) return item;

        // The floor, and then never before the item in front of it — otherwise
        // moving the 09:00 item to 15:00 would leave it after the 10:00 one.
        const shifted = Math.max(start, floor, previousEnd ?? 0);
        const duration = end !== null && end > start ? end - start : null;

        if (shifted === start) {
          previousEnd = end ?? start;
          return item;
        }

        const newEnd =
          duration === null
            ? null
            : Math.min(shifted + duration, MINUTES_PER_DAY - 1);
        previousEnd = newEnd ?? shifted;

        return {
          ...item,
          start_time: formatMinutes(shifted),
          end_time: newEnd === null ? item.end_time : formatMinutes(newEnd),
        };
      });

      return { ...day, items };
    }),
  };
}

// Strict, unlike parseTimeLabel in timeline.ts, which is deliberately forgiving
// because it reads times out of free text the AI wrote into a *label*. This
// reads a dedicated "HH:MM" field, so anything else is a malformed answer rather
// than a sentence with a time in it.
function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * MINUTES_PER_HOUR + minutes;
}
