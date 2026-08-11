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
};

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
