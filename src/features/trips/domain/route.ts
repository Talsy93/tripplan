import type { ItineraryDay } from "./ai-suggestion";

// The trip's route: the cities the user added things in, in visiting order,
// each with coordinates so it can be pinned on the map.
//
// Order comes from the itinerary's day order when there is an itinerary, and
// otherwise from when each city entered the trip — so the map still works
// while the trip is being planned.

export type RouteStop = {
  city: string;
  latitude: number;
  longitude: number;
  // How many things the user added in this city — shown on the pin's popup.
  itemCount: number;
  // Nights spent here, once there is an itinerary to derive them from.
  nights: number;
  // Itinerary days spent here, for the schedule beside the map.
  days: number[];
};

// A one-line description of the route, for the hero banner: how many stops,
// how many days they cover and how many nights that is. Days are counted
// across the whole route, so a day split between two cities isn't counted
// twice.
export function routeSummary(stops: RouteStop[]) {
  const days = new Set<number>();
  let nights = 0;

  for (const stop of stops) {
    for (const day of stop.days) {
      days.add(day);
    }
    nights += stop.nights;
  }
  return { stopCount: stops.length, dayCount: days.size, nights };
}

// Which city each day ends in, indexed by day number.
//
// A day can touch more than one city; the last item is the one that decides,
// because that is where the traveller ends up. Days whose items all lack a
// city (the AI renamed them) map to null.
export function cityByDay(itinerary: ItineraryDay[]): Map<number, string> {
  const byDay = new Map<number, string>();

  for (const day of itinerary) {
    for (const item of day.items) {
      if (item.city) {
        byDay.set(day.day, item.city);
      }
    }
  }
  return byDay;
}

// Cities in the order the itinerary visits them, with the days spent in each
// and how many nights that comes to.
//
// A night is a transition between two days, so the final day of the trip adds
// none — days 1–3 in one city is three days and two nights, the way travel
// itineraries are normally counted.
export function itineraryStops(
  itinerary: ItineraryDay[],
): { city: string; days: number[]; nights: number }[] {
  const byDay = cityByDay(itinerary);
  const dayNumbers = [...byDay.keys()].sort((a, b) => a - b);
  const lastDay = dayNumbers.at(-1);

  const stops = new Map<
    string,
    { city: string; days: number[]; nights: number }
  >();

  for (const dayNumber of dayNumbers) {
    const city = byDay.get(dayNumber);
    if (!city) continue;

    let stop = stops.get(city);
    if (!stop) {
      stop = { city, days: [], nights: 0 };
      stops.set(city, stop);
    }
    stop.days.push(dayNumber);
    if (dayNumber !== lastDay) {
      stop.nights += 1;
    }
  }
  // Map preserves insertion order, which is ascending day order.
  return [...stops.values()];
}

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
