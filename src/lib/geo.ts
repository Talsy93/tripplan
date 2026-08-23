// Plain geographic math with no feature dependencies — kept out of
// features/trips/domain/place.ts on purpose. That file and domain/ai-suggestion.ts
// both need a distance calculation, and place.ts already imports from
// ai-suggestion.ts (for aiCategoryKeySchema); having ai-suggestion.ts import
// distanceKm back from place.ts would make the two files import each other,
// which broke the production build (a circular module evaluation order that
// left an unrelated export in its temporal dead zone).

// Distance in kilometres between two points. Haversine on a spherical earth —
// accurate to well under a percent at the city/country scale this app uses it
// at (ranking search results near a city centre, deciding whether two
// suggested destinations are really the same place).
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export type Located<T> = T & { latitude: number; longitude: number };

// Reorders stops so that geographically close ones sit next to each other.
//
// Nearest-neighbour from the first element, which is deliberate rather than a
// shortcut: the first city is where the trip actually lands (the caller passes
// them in arrival order), so the route should start there and not at whichever
// end a symmetric optimiser happened to prefer. Nearest-neighbour is not the
// optimal tour, but "optimal" is the travelling-salesman problem and the
// difference is invisible at five or six stops — while visiting Osaka between
// two Tokyo days, which is what the naive order produced, is not.
//
// Anything without coordinates keeps its relative order and goes last: it
// cannot be compared on distance, and guessing a position for it would move a
// city for no reason.
export function orderByProximity<T>(stops: Located<T>[]): Located<T>[];
export function orderByProximity<T extends { latitude: number | null; longitude: number | null }>(
  stops: T[],
): T[];
export function orderByProximity<
  T extends { latitude: number | null; longitude: number | null },
>(stops: T[]): T[] {
  const located = stops.filter(
    (stop): stop is T & { latitude: number; longitude: number } =>
      typeof stop.latitude === "number" && typeof stop.longitude === "number",
  );
  const unlocated = stops.filter(
    (stop) =>
      typeof stop.latitude !== "number" || typeof stop.longitude !== "number",
  );

  if (located.length < 3) return [...located, ...unlocated];

  const remaining = [...located];
  const ordered = [remaining.shift()!];

  while (remaining.length > 0) {
    const from = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const distance = distanceKm(from, remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return [...ordered, ...unlocated];
}

// The point most of the stops are near — the median of each axis rather than
// the mean, so one badly geocoded city cannot drag the centre towards itself.
// That matters because the whole reason this exists is to find such a city.
export function medianPoint(
  points: { latitude: number; longitude: number }[],
): { latitude: number; longitude: number } | null {
  if (points.length === 0) return null;

  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  };

  return {
    latitude: median(points.map((p) => p.latitude)),
    longitude: median(points.map((p) => p.longitude)),
  };
}
