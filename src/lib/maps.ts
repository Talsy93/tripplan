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
