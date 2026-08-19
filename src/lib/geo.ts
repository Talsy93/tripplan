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
