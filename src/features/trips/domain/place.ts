import * as z from "zod";
import { distanceKm } from "@/lib/geo";
import { aiCategoryKeySchema } from "./ai-suggestion";

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

// How many things the trip already holds in each search category.
//
// The column carries two vocabularies — the AI guide's (areas, experiences…)
// and the search's six — so the overlapping keys, restaurants and attractions,
// count guide items too. That is the honest answer to "how many restaurants
// are in my trip", which is what the tile is asking.
export function savedCountsByCategory(
  items: { category: string }[],
): Record<PlaceCategory, number> {
  const counts = Object.fromEntries(
    Object.keys(PLACE_CATEGORIES).map((key) => [key, 0]),
  ) as Record<PlaceCategory, number>;

  for (const item of items) {
    if (item.category in counts) {
      counts[item.category as PlaceCategory] += 1;
    }
  }
  return counts;
}

// What to call one selected item, across both vocabularies.
//
// Distinct from PLACE_CATEGORIES[].label on purpose: that names a filter chip
// ("מסעדות"), this names a thing ("מסעדה"). Kept in one place because it is
// needed by the trip page, the city guide and the itinerary prompt — and when
// the search's six categories were added, the prompt's private copy was missed
// and started feeding the AI raw keys.
const CATEGORY_LABELS: Record<string, string> = {
  areas: "אזור לינה",
  restaurants: "מסעדה",
  attractions: "אטרקציה",
  experiences: "חוויה",
  cafes: "בית קפה",
  bakeries: "מאפייה",
  shopping: "שופינג",
  temples: "מקדש",
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

// Selected items carry a category from one of two vocabularies: the four an AI
// city guide produces, and the six the attractions search uses. They share one
// column, so anything validating a category has to accept both — validating
// against the guide's four alone would make removing a searched place fail
// silently.
export const selectableCategorySchema = z.union([
  aiCategoryKeySchema,
  placeCategorySchema,
]);
export type SelectableCategory = z.infer<typeof selectableCategorySchema>;

// ---- A place typed in by hand --------------------------------------------
//
// The search only knows what OpenStreetMap knows, and OSM does not know about
// the restaurant a friend recommended. This is the escape hatch.
//
// It lands in the same table as everything else, as source='manual' with no
// external_id — the pair is what tells the two kinds of "manual" row apart:
// a searched place always carries the OSM id it came from, a typed one never
// does. getAddedPlaces filters on external_id being present for exactly this
// reason, so typed places cannot disturb the search's "already added" badges.
//
// Categories are the search's six rather than the AI guide's four: this is a
// place, and those are the labels the explore grid already shows.
export const manualPlaceSchema = z.object({
  name: z.string().trim().min(1, { error: "יש למלא שם." }).max(200, {
    error: "השם ארוך מדי.",
  }),
  city: z.string().trim().min(1, { error: "יש למלא עיר." }).max(120, {
    error: "שם העיר ארוך מדי.",
  }),
  category: placeCategorySchema,
  // Optional: a name and a city are enough to find most places.
  address: z.string().trim().max(300, { error: "הכתובת ארוכה מדי." }).optional(),
});
export type ManualPlaceInput = z.infer<typeof manualPlaceSchema>;

// What goes in the row's description column, or null when there is nothing to
// say.
//
// Null matters: adding a place that already exists is an upsert, and writing an
// empty description would erase a real one that is already on the row — an AI
// guide item's two sentences, or an address typed a moment earlier. The service
// omits the column entirely when this returns null, which leaves it untouched.
export function manualPlaceDescription(
  address: string | null | undefined,
): string | null {
  const trimmed = (address ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const placeSearchRequestSchema = z.object({
  tripId: z.uuid(),
  city: z.string().trim().min(1, { error: "יש לבחור יעד." }),
  category: placeCategorySchema.optional(),
  // Free-text search, matched against the place's name.
  query: z.string().trim().max(80).optional(),
  // Overrides the city's own centre with a specific point — "search near
  // this result" instead of near the whole city. A big city's centre can be
  // many kilometres from a district the user actually cares about, so
  // re-centring on a place the user already found is more accurate than
  // widening the city-wide radius would be.
  near: z
    .object({ latitude: z.number(), longitude: z.number() })
    .optional(),
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

// Validates a Place arriving from the client, before it is written to the trip.
// The client is the one that received it from the search, but it is still
// untrusted input on the way back in.
export const placeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  localName: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: placeCategorySchema.nullable(),
  cuisine: z.string().max(200).nullable(),
  openingHours: z.string().max(200).nullable(),
  website: z.string().max(500).nullable(),
  phone: z.string().max(60).nullable(),
  address: z.string().max(300).nullable(),
  brand: z.string().max(200).nullable(),
  notable: z.boolean(),
  detailCount: z.number().int().min(0).max(10),
});

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

// Re-exported for callers that already import distance ranking alongside the
// rest of this module (comparePlaces uses it directly below). The
// implementation lives in lib/geo.ts — see that file for why.
export { distanceKm };
