// Turns a day's itinerary into something that can be drawn on an hour axis.
//
// The times are free text. The prompt asks the AI for "HH:MM" and it usually
// obliges, but nothing enforces it — an entry can come back as "בוקר" or
// "09:00-11:00" or empty. So parsing is defensive, and an entry whose time
// can't be read isn't dropped: it goes in `unscheduled` and gets listed under
// the graphic. Losing an item the user picked would be worse than not placing
// it on the axis.

import { distanceKm } from "./place";
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

export type DayTimeline = {
  day: number;
  // The axis, snapped out to whole hours so the gridlines are round numbers.
  startMinutes: number;
  endMinutes: number;
  entries: TimelineEntry[];
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

export function buildDayTimeline(day: ItineraryDay): DayTimeline {
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

  const first = scheduled[0]?.startMinutes ?? 9 * MINUTES_PER_HOUR;
  const last = scheduled.at(-1)?.endMinutes ?? 18 * MINUTES_PER_HOUR;

  return {
    day: day.day,
    startMinutes: floorToHour(first),
    endMinutes: ceilToHour(last),
    entries: scheduled,
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
