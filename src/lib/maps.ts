// Builds a free Google Maps search link (a plain URL — no Maps API, no billing).
export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Google's documented travel modes. Transit is the one this project cares
// about: real public-transport routing does not exist as a free API anywhere
// (see the C4 note in PROJECT_PLAN.md), and handing the trip off to Google Maps
// is the way to get it without paying for it.
export type TravelMode = "transit" | "walking" | "driving" | "bicycling";

// A directions link from one place to another. Also just a URL — the Maps URLs
// scheme is free and keyless, unlike the Directions API.
//
// `origin` and `destination` are whatever identifies a place: a "lat,lng" pair
// when coordinates are known, otherwise free text for Google to geocode.
export function googleMapsDirectionsUrl(
  origin: string,
  destination: string,
  travelMode: TravelMode = "transit",
) {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: travelMode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// A whole route in one link: first stop, last stop, and everything between as
// waypoints. Free and keyless like the two above — the Maps URLs scheme, not
// the Directions API.
//
// Google caps `waypoints` at nine for an unauthenticated URL, so a longer trip
// is trimmed to its first nine intermediate stops rather than silently
// producing a link that errors. A ten-city trip is not the common case and half
// a route is more useful than none.
//
// Transit, not walking, and that is a correction to the design rather than a
// shortcut: the stops on this map are cities, and a walking route from Tokyo to
// Kyoto is not a thing anyone wants. Within a city the day view already offers
// per-item directions from the night's lodging.
const MAX_WAYPOINTS = 9;

export function googleMapsRouteUrl(
  stops: string[],
  travelMode: TravelMode = "transit",
): string | null {
  const named = stops.map((stop) => stop.trim()).filter(Boolean);
  if (named.length < 2) return null;

  const origin = named[0];
  const destination = named[named.length - 1];
  const waypoints = named.slice(1, -1).slice(0, MAX_WAYPOINTS);

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: travelMode,
  });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
