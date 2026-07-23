// Builds a free Google Maps search link (a plain URL — no Maps API, no billing).
export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
