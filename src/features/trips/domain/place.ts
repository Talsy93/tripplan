import * as z from "zod";

// A real-world place found on OpenStreetMap, as the app cares about it.
// Overpass returns dozens of tags per element; this is the subset worth
// showing, already cleaned up.

export const placeCategorySchema = z.enum([
  "restaurants",
  "cafes",
  "bakeries",
  "shopping",
  "temples",
  "attractions",
]);
export type PlaceCategory = z.infer<typeof placeCategorySchema>;

// Each category maps to the OSM tag filters that define it. Kept as data
// rather than branching in the query builder, so adding a category is a
// one-line change here.
//
// Tag reference: https://wiki.openstreetmap.org/wiki/Map_features
export const PLACE_CATEGORIES: Record<
  PlaceCategory,
  { label: string; emoji: string; filters: string[] }
> = {
  restaurants: {
    label: "מסעדות",
    emoji: "🍜",
    filters: ["amenity=restaurant", "amenity=fast_food"],
  },
  cafes: {
    label: "בתי קפה",
    emoji: "☕",
    filters: ["amenity=cafe"],
  },
  bakeries: {
    label: "מאפיות",
    emoji: "🥐",
    filters: ["shop=bakery", "shop=pastry"],
  },
  shopping: {
    label: "שופינג",
    emoji: "🛍️",
    filters: ["shop=mall", "shop=department_store", "shop=clothes"],
  },
  temples: {
    label: "מקדשים",
    emoji: "⛩️",
    filters: ["amenity=place_of_worship", "historic=shrine"],
  },
  attractions: {
    label: "אטרקציות",
    emoji: "🗼",
    filters: ["tourism=attraction", "tourism=museum", "tourism=viewpoint"],
  },
};

export const placeSearchRequestSchema = z.object({
  tripId: z.uuid(),
  city: z.string().trim().min(1, { error: "יש לבחור יעד." }),
  category: placeCategorySchema.optional(),
  // Free-text search, matched against the place's name.
  query: z.string().trim().max(80).optional(),
});
export type PlaceSearchRequest = z.infer<typeof placeSearchRequestSchema>;

export type Place = {
  // OSM's own identifier ("node/12345"), stable enough to use as a key.
  id: string;
  // The most readable name available: Hebrew, then English, then whatever the
  // local `name` tag holds.
  name: string;
  // The local-language name, when it differs from the one shown — worth
  // keeping: it's what's on the shopfront and what a taxi driver reads.
  localName: string | null;
  latitude: number;
  longitude: number;
  // Which of our categories matched — an element can carry several tags, so
  // this is the category that was asked for, not a property of the place.
  category: PlaceCategory | null;
  // Details worth showing, all optional because OSM data is uneven.
  cuisine: string | null;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  // The chain or operator, when it is one — a strong signal the place is real.
  brand: string | null;
  // True when the place has a Wikipedia or Wikidata entry. OSM has no reviews
  // or ratings, so this is the closest thing to "this is a known place":
  // somebody thought it notable enough to write an encyclopedia article about.
  notable: boolean;
  // How many of the details above are actually filled in. Used to drop
  // near-empty entries and to rank what's left.
  detailCount: number;
};

// The details a place is scored on. A name alone says nothing — these are what
// make an entry worth putting in front of someone planning a trip.
const SCORED_DETAILS = [
  "cuisine",
  "openingHours",
  "website",
  "phone",
  "address",
  "brand",
] as const;

export function countDetails(place: {
  cuisine: string | null;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  brand: string | null;
}) {
  return SCORED_DETAILS.filter((key) => place[key]).length;
}

// Minimum detail for a place to be shown at all. OSM is full of entries that
// are a name and nothing else — a pin someone dropped years ago — and those are
// noise in a list of suggestions. A notable place is kept regardless: a
// Wikipedia-worthy shrine doesn't need a phone number to be worth visiting.
export const MIN_DETAILS = 2;

export function isWorthShowing(place: Place) {
  return place.notable || place.detailCount >= MIN_DETAILS;
}

// Best first: known places, then the ones we can say most about, then the
// closest. Distance breaks ties rather than leading, because a well-documented
// landmark two kilometres out beats a nameless cafe next door.
export function comparePlaces(
  a: Place,
  b: Place,
  center: { latitude: number; longitude: number },
) {
  if (a.notable !== b.notable) return a.notable ? -1 : 1;
  if (a.detailCount !== b.detailCount) return b.detailCount - a.detailCount;
  return distanceKm(center, a) - distanceKm(center, b);
}

// Distance in kilometres between two points, for sorting results by how close
// they are to the city centre. Haversine on a spherical earth — accurate to
// well under a percent at city scale.
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
