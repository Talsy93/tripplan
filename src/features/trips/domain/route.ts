// The trip's route: the cities the user added things in, in visiting order,
// each with coordinates so it can be pinned on the map.
//
// Order comes from when the city entered the trip (stage 12a). Once itinerary
// items carry a city, this will switch to the itinerary's day order.

export type RouteStop = {
  city: string;
  latitude: number;
  longitude: number;
  // How many things the user added in this city — shown on the pin's popup.
  itemCount: number;
};

// Cities the user added things in but that couldn't be geocoded. Surfaced so
// the map can say so instead of silently dropping them.
export type TripRoute = {
  stops: RouteStop[];
  unlocatedCities: string[];
};

// The map needs a centre and a zoom before it can render. Derives both from
// the stops so the whole route is comfortably in frame.
export function routeBounds(
  stops: RouteStop[],
): { center: [number, number]; zoom: number } | null {
  if (stops.length === 0) return null;

  const lats = stops.map((s) => s.latitude);
  const lngs = stops.map((s) => s.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center: [number, number] = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2,
  ];

  // A single stop has no span to fit, so pick a city-level zoom.
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  if (span === 0) return { center, zoom: 10 };

  // Each zoom level halves the visible span; 360° fills the world at zoom 0.
  // The 0.6 factor leaves margin so pins aren't flush against the edges.
  const zoom = Math.round(Math.log2(360 / span) * 0.6) + 2;
  return { center, zoom: Math.min(Math.max(zoom, 2), 12) };
}
