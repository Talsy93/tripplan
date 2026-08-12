// Colour identity for cities and categories.
//
// The palette lives in globals.css as six .tone-* classes, each setting a
// tint/ink/dot trio. This module decides *which* city gets which one, and it is
// the only place that decides — a city drawn in rose on the map and in amber in
// the schedule is worse than no colour at all.
//
// Assignment is by position, not by hashing the name. A hash spreads colours
// unpredictably and can hand two adjacent stops the same one; position
// guarantees that the first six cities are all different, which is the case
// that matters, and it makes the mapping readable when debugging.

export const TONES = [
  "rose",
  "amber",
  "lilac",
  "mint",
  "sky",
  "peach",
] as const;

export type Tone = (typeof TONES)[number];

// The class to put on a container so its subtree can use bg-tone /
// text-tone-ink / bg-tone-dot without knowing which colour it got.
export function toneClass(tone: Tone): string {
  return `tone-${tone}`;
}

export function toneByIndex(index: number): Tone {
  // Negative or fractional input would silently pick undefined.
  const safe = Math.max(0, Math.trunc(index));
  return TONES[safe % TONES.length];
}

// Maps each city to a tone, in the order given. Pass the cities in route
// order — the caller owns that, because only it knows whether an itinerary
// exists to order them by.
//
// Duplicates keep their first assignment, so a city revisited later in the trip
// (Tokyo → Hakone → Tokyo) stays the same colour both times.
export function cityToneMap(cities: string[]): Map<string, Tone> {
  const map = new Map<string, Tone>();

  for (const city of cities) {
    if (!city || map.has(city)) continue;
    map.set(city, toneByIndex(map.size));
  }
  return map;
}

// Convenience for the common "I have the map, give me a class" call. Falls back
// to the neutral tone, which renders as the app's default surface rather than
// as nothing.
export function cityToneClass(
  tones: Map<string, Tone>,
  city: string | null,
): string {
  const tone = city ? tones.get(city) : undefined;
  return tone ? toneClass(tone) : "";
}
