import { formatMinutes, parseTimeLabel } from "./timeline";
import type { ItineraryDay, ItineraryEntry } from "./ai-suggestion";

// Re-timing a day around where you actually are.
//
// You planned the market for 09:00 and got there at 08:20 — or at 10:10. The
// day should follow you: the item you arrived at starts now, keeps its length,
// and everything after it slides by the same amount. Two things do not slide:
//
//   * a `fixed` item — a booked table, a timed ticket. It keeps its hour, and
//     because the items after it were planned relative to it, they keep theirs
//     too. So the shift runs from the arrival up to the next fixed item and
//     stops there.
//   * the end of the day — nothing is pushed past 23:59.
//
// Pure: takes the day, returns the label changes. The caller persists them.

export type TimeChange = {
  id: string;
  title: string;
  from: { startLabel: string; endLabel: string };
  to: { startLabel: string; endLabel: string };
  fixed: boolean;
};

// Below this many minutes the plan and reality agree; nothing to do.
export const REFLOW_THRESHOLD_MINUTES = 5;
const DAY_END = 23 * 60 + 59;

export function reflowFromArrival(
  day: ItineraryDay,
  arrivedId: string,
  nowMinutes: number,
): TimeChange[] {
  const timed = day.items
    .map((entry) => ({ entry, start: parseTimeLabel(entry.startLabel) }))
    .filter((item): item is { entry: ItineraryEntry; start: number } =>
      item.start !== null,
    )
    .sort((a, b) => a.start - b.start);

  const index = timed.findIndex((item) => item.entry.id === arrivedId);
  if (index < 0) return [];

  const arrived = timed[index];
  const delta = nowMinutes - arrived.start;
  if (Math.abs(delta) < REFLOW_THRESHOLD_MINUTES) return [];

  const changes: TimeChange[] = [];
  for (let i = index; i < timed.length; i++) {
    const { entry, start } = timed[i];
    // The arrival itself moves even if it is fixed — you are there. Anything
    // fixed after it anchors the rest of the day.
    if (i > index && entry.fixed) break;

    const end = parseTimeLabel(entry.endLabel);
    const newStart = clamp(start + delta);
    const newEnd = end === null ? null : clamp(end + delta);

    const to = {
      startLabel: formatMinutes(newStart),
      endLabel: newEnd === null ? entry.endLabel : formatMinutes(newEnd),
    };
    if (to.startLabel === entry.startLabel && to.endLabel === entry.endLabel) {
      continue;
    }
    changes.push({
      id: entry.id,
      title: entry.title,
      from: { startLabel: entry.startLabel, endLabel: entry.endLabel },
      to,
      fixed: entry.fixed ?? false,
    });
  }
  return changes;
}

function clamp(minutes: number): number {
  return Math.min(DAY_END, Math.max(0, Math.round(minutes)));
}

// --- arrival detection -------------------------------------------------------

// Within this distance of a place you are "there". 150m is a city block; the
// GPS on a phone in a street is good to ~20m, worse between tall buildings.
export const ARRIVAL_RADIUS_METERS = 150;

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The day's entry the traveller is standing at, if any. Only entries with
// coordinates can be detected, and only ones whose planned start is off from
// now by more than the threshold are worth asking about.
export function detectArrival(
  day: ItineraryDay,
  position: { latitude: number; longitude: number },
  nowMinutes: number,
  radiusMeters = ARRIVAL_RADIUS_METERS,
): ItineraryEntry | null {
  let best: { entry: ItineraryEntry; distance: number } | null = null;
  for (const entry of day.items) {
    if (entry.latitude === null || entry.longitude === null) continue;
    const start = parseTimeLabel(entry.startLabel);
    if (start === null) continue;
    if (Math.abs(nowMinutes - start) < REFLOW_THRESHOLD_MINUTES) continue;
    const distance = distanceMeters(position, {
      latitude: entry.latitude,
      longitude: entry.longitude,
    });
    if (distance <= radiusMeters && (!best || distance < best.distance)) {
      best = { entry, distance };
    }
  }
  return best?.entry ?? null;
}
