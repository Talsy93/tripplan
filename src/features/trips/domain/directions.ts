import type { Booking } from "./booking";
import type { ItineraryEntry } from "./ai-suggestion";

// How a place is named to Google Maps, for a directions link.
//
// Two rules, kept apart because the two ends of the route know different things:
// a lodging booking has an address the user typed, an itinerary entry sometimes
// has exact coordinates and otherwise only a name.
//
// Both return null when there is nothing usable. A link built from an empty
// string would open Maps on a blank route, which is worse than no link.

// Coordinates are formatted the way the Maps URL scheme expects, and rounded to
// six decimals — roughly 0.1 m, well past the precision OSM data carries, and
// short enough to keep the URL readable.
function latLng(latitude: number, longitude: number): string {
  return `${Number(latitude.toFixed(6))},${Number(longitude.toFixed(6))}`;
}

function isUsableCoordinate(
  latitude: number | null,
  longitude: number | null,
): boolean {
  if (latitude === null || longitude === null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Exactly (0, 0) is in the Gulf of Guinea. As real data it is a null that
  // was written as a number, and routing someone into the ocean is worse than
  // falling back to the place's name.
  return !(latitude === 0 && longitude === 0);
}

// Where the day starts from: the hotel.
//
// The address wins when there is one — it is the most precise thing available
// and it is what the user typed off their booking. The name plus the city is the
// fallback, because Google resolves "Shinjuku Granbell Hotel Tokyo" perfectly
// well and a booking without an address still deserves a working link.
export function lodgingOrigin(
  booking: Pick<Booking, "title" | "address" | "city">,
): string | null {
  const address = booking.address?.trim();
  if (address) return address;

  const title = booking.title?.trim();
  const city = booking.city?.trim();
  if (!title) return city || null;

  // "ריוקאן קיוטו" in Kyoto would otherwise become "ריוקאן קיוטו קיוטו".
  // Harmless to a geocoder, but the name is already doing the city's job.
  if (city && !includesWord(title, city)) return `${title} ${city}`;
  return title;
}

// Case-insensitive containment. Deliberately not a word-boundary regex: \b is
// defined on ASCII word characters, so it does not fire around Hebrew or
// Japanese text and would silently never match.
function includesWord(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

// Where the day is going: one itinerary item.
//
// Coordinates are preferred when present — they are unambiguous, and they are
// the reason an item that came from the attractions search routes to the right
// door instead of to a chain branch across town. Most entries are AI guide
// items with no coordinates at all, so the name plus the city carries the rest.
export function entryDestination(
  entry: Pick<ItineraryEntry, "title" | "city" | "latitude" | "longitude">,
): string | null {
  if (isUsableCoordinate(entry.latitude, entry.longitude)) {
    return latLng(entry.latitude as number, entry.longitude as number);
  }

  const title = entry.title?.trim();
  if (!title) return null;

  const city = entry.city?.trim();
  return city ? `${title} ${city}` : title;
}
