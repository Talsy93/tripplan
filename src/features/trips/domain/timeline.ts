// Turns a day's itinerary into something that can be drawn on an hour axis.
//
// The times are free text. The prompt asks the AI for "HH:MM" and it usually
// obliges, but nothing enforces it — an entry can come back as "בוקר" or
// "09:00-11:00" or empty. So parsing is defensive, and an entry whose time
// can't be read isn't dropped: it goes in `unscheduled` and gets listed under
// the graphic. Losing an item the user picked would be worse than not placing
// it on the axis.

import { distanceKm } from "@/lib/geo";
import type { Booking } from "./booking";
import type { ItineraryDay, ItineraryEntry } from "./ai-suggestion";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
// What to assume an entry lasts when it has a start but no usable end.
const DEFAULT_DURATION_MIN = 60;

export type TimelineEntry = {
  entry: ItineraryEntry;
  startMinutes: number;
  endMinutes: number;
};

export type Transition = {
  // The entry this gap follows, so it can be keyed in a list.
  afterId: string;
  startMinutes: number;
  minutes: number;
  // Straight-line distance to the next place, when both ends have coordinates
  // — which today means both came from the attractions search. Null otherwise,
  // and null is the common case.
  distanceKm: number | null;
  // Rough walking time, only when the distance is one a person would actually
  // walk. Null past that, because the alternative — bus, metro, taxi — has no
  // free routing service, and a made-up number is worse than none.
  walkMinutes: number | null;
};

// Comfortable city walking pace, km/h.
const WALKING_KMH = 4.5;
// Past this, walking stops being the answer and we say nothing about how to
// get there.
const MAX_WALK_KM = 2.5;
// Straight-line distance understates real walking, which follows streets.
const STREET_DETOUR_FACTOR = 1.3;

// A booking drawn on the day's axis: a flight, a train, a hotel check-in.
//
// Kept apart from TimelineEntry rather than converted into one, because the
// two are different kinds of fact and the difference matters on screen. An
// itinerary entry is a suggestion with a free-text time the model wrote and
// the user can edit; a booking has a real timestamp that was paid for. It is
// not editable here, it cannot be removed here, and — most importantly — a
// 07:40 departure is the one thing on the day that genuinely cannot move.
export type TimelineBooking = {
  booking: Booking;
  startMinutes: number;
  endMinutes: number;
  // True when the booking runs past midnight into the next day — a long-haul
  // flight, most often. The block is clipped at the axis and says so, rather
  // than being drawn with a negative height.
  continuesNextDay: boolean;
};

export type DayTimeline = {
  day: number;
  // The axis, snapped out to whole hours so the gridlines are round numbers.
  startMinutes: number;
  endMinutes: number;
  entries: TimelineEntry[];
  // Bookings that fall on this day, on the same axis as the entries.
  bookings: TimelineBooking[];
  // Gaps between consecutive entries — the only travel information available
  // without coordinates for every item.
  transitions: Transition[];
  unscheduled: ItineraryEntry[];
};

// Reads a clock time out of a label. Accepts "9:00", "09:00", "09.00" and
// leading text like "09:00-11:00", and rejects anything that isn't a real
// time of day.
export function parseTimeLabel(label: string): number | null {
  const match = /(\d{1,2})[:.](\d{2})/.exec(label);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * MINUTES_PER_HOUR + minutes;
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR) % 24;
  const rest = minutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// A gap shorter than this is just the schedule breathing, not a journey.
const MIN_TRANSITION_MIN = 10;

// Where a booking sits on one day's axis.
//
// `zone` is a parameter for the same reason it is one in bookingsByDay: the
// hour a 23:40 flight departs depends on whose calendar you ask, and the
// server and the browser must not disagree about it across hydration.
//
// A booking that started on an earlier day and is still running (an overnight
// flight) is clamped to midnight, so the block covers the part of it that
// actually belongs to this day.
function toTimelineBooking(
  booking: Booking,
  date: string,
  zone: string,
): TimelineBooking | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const at = (iso: string) => {
    const moment = new Date(iso);
    if (Number.isNaN(moment.getTime())) return null;
    const parts = formatter.formatToParts(moment);
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? NaN);
    const day = `${parts.find((p) => p.type === "year")?.value}-${
      parts.find((p) => p.type === "month")?.value
    }-${parts.find((p) => p.type === "day")?.value}`;
    const hour = get("hour");
    const minute = get("minute");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    // Intl renders midnight as 24:00 with hour12:false in some environments.
    return { day, minutes: (hour % 24) * MINUTES_PER_HOUR + minute };
  };

  const start = at(booking.starts_at);
  if (!start) return null;
  const end = booking.ends_at ? at(booking.ends_at) : null;

  const startsToday = start.day === date;
  const endsToday = end?.day === date;

  // Neither end touches this day — but it may still span it entirely (day 2 of
  // a three-day rail journey). Covered rather than dropped.
  if (!startsToday && !endsToday) {
    if (!end || start.day > date || end.day < date) return null;
    return {
      booking,
      startMinutes: 0,
      endMinutes: MINUTES_PER_DAY,
      continuesNextDay: true,
    };
  }

  const startMinutes = startsToday ? start.minutes : 0;

  // Three different situations, and conflating the first two drew a flight
  // with no arrival time as a nine-hour block running to midnight:
  //
  //   no end at all   — unknown duration. A short readable block, because the
  //                     honest statement is "departs at 20:00", not "occupies
  //                     the rest of the day".
  //   end on a later day — genuinely still going at midnight. Runs to the edge
  //                     and is flagged as continuing.
  //   end today       — the real duration, floored so a zero-length block is
  //                     still visible.
  const endMinutes =
    end === null
      ? startMinutes + MIN_BOOKING_MIN
      : endsToday
        ? Math.max(end.minutes, startMinutes + MIN_BOOKING_MIN)
        : MINUTES_PER_DAY;

  return {
    booking,
    startMinutes,
    endMinutes: Math.min(endMinutes, MINUTES_PER_DAY),
    continuesNextDay: end !== null && !endsToday,
  };
}

// A booking with no end time still needs a block tall enough to read. Also the
// floor for one whose end is the same minute as its start.
const MIN_BOOKING_MIN = 45;

export function buildDayTimeline(
  day: ItineraryDay,
  // The bookings that fall on this day, and the calendar date it is — both
  // needed to place a booking's real timestamp on the axis. Omitted by callers
  // that have neither, which is what the "today" tab did before flights were
  // drawn here.
  options: { bookings?: Booking[]; date?: string | null; zone?: string } = {},
): DayTimeline {
  const scheduled: TimelineEntry[] = [];
  const unscheduled: ItineraryEntry[] = [];

  for (const entry of day.items) {
    const start = parseTimeLabel(entry.startLabel);
    if (start === null) {
      unscheduled.push(entry);
      continue;
    }

    const parsedEnd = parseTimeLabel(entry.endLabel);
    // An end before its start means the AI wrote something inconsistent, or
    // the entry runs past midnight. Either way a default block beats a
    // negative-height one.
    const end =
      parsedEnd !== null && parsedEnd > start
        ? parsedEnd
        : Math.min(start + DEFAULT_DURATION_MIN, MINUTES_PER_DAY);

    scheduled.push({ entry, startMinutes: start, endMinutes: end });
  }

  scheduled.sort((a, b) => a.startMinutes - b.startMinutes);

  const transitions: Transition[] = [];
  for (let i = 0; i < scheduled.length - 1; i += 1) {
    const from = scheduled[i];
    const to = scheduled[i + 1];
    const gap = to.startMinutes - from.endMinutes;
    if (gap < MIN_TRANSITION_MIN) continue;

    const distanceKm = straightLineKm(from.entry, to.entry);
    transitions.push({
      afterId: from.entry.id,
      startMinutes: from.endMinutes,
      minutes: gap,
      distanceKm,
      walkMinutes:
        distanceKm !== null && distanceKm <= MAX_WALK_KM
          ? Math.max(
              1,
              Math.round(
                ((distanceKm * STREET_DETOUR_FACTOR) / WALKING_KMH) *
                  MINUTES_PER_HOUR,
              ),
            )
          : null,
    });
  }

  // Bookings are placed before the axis is sized, because a 06:00 flight has
  // to widen the axis — otherwise the day would start at the first activity
  // and the flight would sit clamped at the top edge, reading as though it
  // left at the same time as breakfast.
  const bookings: TimelineBooking[] = [];
  if (options.date && options.bookings?.length) {
    for (const booking of options.bookings) {
      const placed = toTimelineBooking(
        booking,
        options.date,
        options.zone ?? "UTC",
      );
      if (placed) bookings.push(placed);
    }
    bookings.sort((a, b) => a.startMinutes - b.startMinutes);
  }

  const starts = [
    ...scheduled.map((entry) => entry.startMinutes),
    ...bookings.map((entry) => entry.startMinutes),
  ];
  const ends = [
    ...scheduled.map((entry) => entry.endMinutes),
    ...bookings.map((entry) => entry.endMinutes),
  ];

  const first = starts.length > 0 ? Math.min(...starts) : 9 * MINUTES_PER_HOUR;
  const last = ends.length > 0 ? Math.max(...ends) : 18 * MINUTES_PER_HOUR;

  return {
    day: day.day,
    startMinutes: floorToHour(first),
    endMinutes: ceilToHour(last),
    entries: scheduled,
    bookings,
    transitions,
    unscheduled,
  };
}

// The whole hours the axis should draw a line at.
export function axisHours(timeline: DayTimeline): number[] {
  const hours: number[] = [];
  for (
    let minute = timeline.startMinutes;
    minute <= timeline.endMinutes;
    minute += MINUTES_PER_HOUR
  ) {
    hours.push(minute);
  }
  return hours;
}

// Where a moment sits on the axis, 0–100.
export function positionPercent(timeline: DayTimeline, minutes: number) {
  const span = timeline.endMinutes - timeline.startMinutes;
  if (span <= 0) return 0;
  const clamped = Math.min(
    Math.max(minutes, timeline.startMinutes),
    timeline.endMinutes,
  );
  return ((clamped - timeline.startMinutes) / span) * 100;
}

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} דק׳`;
  if (rest === 0) return hours === 1 ? "שעה" : `${hours} שעות`;
  return `${hours}:${String(rest).padStart(2, "0")} שעות`;
}

function straightLineKm(from: ItineraryEntry, to: ItineraryEntry) {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null
  ) {
    return null;
  }
  return distanceKm(
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  );
}

export function distanceLabel(km: number) {
  // Under a kilometre, metres are the unit a person thinks in.
  if (km < 1) return `${Math.round(km * 1000)} מ׳`;
  return `${km.toFixed(1)} ק״מ`;
}

function floorToHour(minutes: number) {
  return Math.floor(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

function ceilToHour(minutes: number) {
  return Math.ceil(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}
