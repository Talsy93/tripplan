import * as z from "zod";
import type { PlaceCategory } from "./place";

// "גילוי" — the swipe deck (design/stitch/…/discover_page, 2026-09-24).
//
// Asked for as: choose a destination in the trip — a city like "טוקיו" or a
// country like "יפן" — and get a deck of attractions from several categories,
// filterable, where a swipe right adds it and a swipe left passes.
//
// Every card is real and free. The places come from OpenStreetMap around each
// city, and only the ones with a Wikidata entry are dealt: that entry is what
// gives a card its Hebrew name, its photograph (Wikimedia Commons) and its two
// lines of description (Wikipedia). A place nobody has written about has none
// of the three, and a deck of grey cards with a street address is not the
// screen that was drawn.
//
// What the export draws and no free source holds is not invented: there is no
// star rating and no review count anywhere open, so that slot says how many
// Wikipedias have an article on the place — a real measure of how known it is.

// The export's chips, in its order, with its emoji. Emoji here for the reason
// PLACE_CATEGORIES gives: a chip carousel where the emoji is the only mark.
export const DISCOVER_CATEGORIES = {
  all: { label: "הכל", emoji: "✨", filters: [] as string[] },
  mustsee: {
    label: "אתרי חובה",
    emoji: "🏛️",
    filters: [
      "tourism=attraction",
      "tourism=museum",
      "historic=monument",
      "historic=castle",
      "historic=archaeological_site",
      "amenity=place_of_worship",
    ],
  },
  food: {
    label: "קולינריה",
    emoji: "🍝",
    filters: ["amenity=restaurant", "amenity=cafe", "amenity=marketplace"],
  },
  nature: {
    label: "טבע ונוף",
    emoji: "🌿",
    filters: [
      "leisure=park",
      "leisure=garden",
      "tourism=viewpoint",
      "natural=peak",
      "natural=beach",
    ],
  },
  shopping: {
    label: "קניות ושווקים",
    emoji: "🛍️",
    filters: [
      "amenity=marketplace",
      "shop=mall",
      "shop=department_store",
      "tourism=gallery",
    ],
  },
  hidden: {
    label: "פינות נסתרות",
    emoji: "💎",
    filters: [
      "historic=memorial",
      "historic=ruins",
      "tourism=artwork",
      "amenity=fountain",
      "historic=building",
    ],
  },
} as const;

export type DiscoverCategory = keyof typeof DISCOVER_CATEGORIES;
export const DISCOVER_CATEGORY_ORDER = Object.keys(
  DISCOVER_CATEGORIES,
) as DiscoverCategory[];
export const discoverCategorySchema = z.enum(
  DISCOVER_CATEGORY_ORDER as [DiscoverCategory, ...DiscoverCategory[]],
);

// "all" is every category's filters together.
export function discoverFilters(category: DiscoverCategory): string[] {
  if (category !== "all") return [...DISCOVER_CATEGORIES[category].filters];
  return [
    ...new Set(
      DISCOVER_CATEGORY_ORDER.flatMap((key) => [
        ...DISCOVER_CATEGORIES[key].filters,
      ]),
    ),
  ];
}

// What a card is: the chip on it, the category it is saved under, and how long
// a visit usually takes. Resolved from the OSM tag that matched, most specific
// first.
type Kind = {
  // The blue chip on the card: "ציון דרך ומורשת".
  label: string;
  // Which chip it belongs to, for filtering an "all" deck locally.
  category: Exclude<DiscoverCategory, "all">;
  // Stored with the place — one of the app's own place categories.
  placeCategory: PlaceCategory;
  // Typical visit, in minutes. A rule of thumb by kind of place, shown as a
  // range with "כ-" — it is guidance, not a measurement.
  visit: [number, number];
};

const KINDS: [string, Kind][] = [
  ["tourism=museum", { label: "מוזיאון", category: "mustsee", placeCategory: "attractions", visit: [90, 120] }],
  ["tourism=gallery", { label: "גלריה", category: "shopping", placeCategory: "attractions", visit: [45, 60] }],
  ["historic=castle", { label: "טירה ומבצר", category: "mustsee", placeCategory: "attractions", visit: [60, 90] }],
  ["historic=archaeological_site", { label: "אתר ארכאולוגי", category: "mustsee", placeCategory: "attractions", visit: [60, 90] }],
  ["historic=monument", { label: "ציון דרך ומורשת", category: "mustsee", placeCategory: "attractions", visit: [30, 45] }],
  ["amenity=place_of_worship", { label: "מבנה דת", category: "mustsee", placeCategory: "temples", visit: [30, 45] }],
  ["tourism=attraction", { label: "אטרקציה", category: "mustsee", placeCategory: "attractions", visit: [45, 60] }],
  ["amenity=marketplace", { label: "שוק", category: "shopping", placeCategory: "shopping", visit: [45, 90] }],
  ["shop=mall", { label: "קניון", category: "shopping", placeCategory: "shopping", visit: [60, 120] }],
  ["shop=department_store", { label: "כלבו", category: "shopping", placeCategory: "shopping", visit: [45, 90] }],
  ["amenity=restaurant", { label: "מסעדה", category: "food", placeCategory: "restaurants", visit: [60, 90] }],
  ["amenity=cafe", { label: "בית קפה", category: "food", placeCategory: "cafes", visit: [30, 45] }],
  ["leisure=park", { label: "פארק", category: "nature", placeCategory: "attractions", visit: [45, 90] }],
  ["leisure=garden", { label: "גן", category: "nature", placeCategory: "attractions", visit: [30, 60] }],
  ["tourism=viewpoint", { label: "נקודת תצפית", category: "nature", placeCategory: "attractions", visit: [20, 30] }],
  ["natural=peak", { label: "פסגה", category: "nature", placeCategory: "attractions", visit: [90, 180] }],
  ["natural=beach", { label: "חוף", category: "nature", placeCategory: "attractions", visit: [90, 180] }],
  ["historic=memorial", { label: "אנדרטה", category: "hidden", placeCategory: "attractions", visit: [15, 30] }],
  ["historic=ruins", { label: "חורבות", category: "hidden", placeCategory: "attractions", visit: [30, 45] }],
  ["tourism=artwork", { label: "יצירת אמנות", category: "hidden", placeCategory: "attractions", visit: [15, 20] }],
  ["amenity=fountain", { label: "מזרקה", category: "hidden", placeCategory: "attractions", visit: [15, 30] }],
  ["historic=building", { label: "מבנה היסטורי", category: "hidden", placeCategory: "attractions", visit: [20, 40] }],
];

// `prefer` is the chip being dealt: the Circus Maximus is a park *and* an
// archaeological site, and under "טבע ונוף" it is the park.
export function kindOf(
  tags: Record<string, string>,
  prefer?: Exclude<DiscoverCategory, "all">,
): Kind | null {
  const matches = KINDS.filter(([filter]) => {
    const [key, value] = filter.split("=");
    return tags[key] === value;
  }).map(([, kind]) => kind);
  return (prefer && matches.find((kind) => kind.category === prefer)) ?? matches[0] ?? null;
}

// Whether a place belongs under a chip at all.
export function matchesCategory(
  tags: Record<string, string>,
  category: DiscoverCategory,
): boolean {
  return discoverFilters(category).some((filter) => {
    const [key, value] = filter.split("=");
    return tags[key] === value;
  });
}

// A card, as the deck receives it. Also the shape the "add" action validates,
// so a card is saved exactly as it was shown.
export const discoverCardSchema = z.object({
  // The OSM id ("node/123"), kept as the place's external id.
  id: z.string().min(1).max(64),
  wikidata: z.string().max(20),
  city: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  // The name on the sign, when it differs: "Fontana di Trevi".
  localName: z.string().max(200).nullable(),
  kindLabel: z.string().max(40),
  category: discoverCategorySchema,
  placeCategory: z.string().max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  image: z.string().max(1000).nullable(),
  summary: z.string().max(1200).nullable(),
  // Where the summary came from, for the "read more" link.
  wikiUrl: z.string().max(500).nullable(),
  // How many language editions of Wikipedia have an article on it.
  languages: z.number().int().min(0).max(400),
  // From OSM's `fee` tag: false = free entry, true = paid, null = unknown.
  fee: z.boolean().nullable(),
  openingHours: z.string().max(200).nullable(),
  website: z.string().max(500).nullable(),
  visit: z.tuple([z.number(), z.number()]),
});
export type DiscoverCard = z.infer<typeof discoverCardSchema>;

// "אתר חובה ברשימה" and "פופולרי" — both read off `languages`. Written about in
// forty languages is a place the world has heard of; in a hundred, it is one
// of the sights of the planet.
export const MUST_SEE_LANGUAGES = 40;
export const POPULAR_LANGUAGES = 70;

// The place's page on Google Maps, where its rating and reviews are.
//
// Asked for as "the rating should come from Google, and the link should go
// through it". The rating itself is only served by the Places API, which needs
// a billing account with a card on file — against the rule that everything
// here is free — so the card links to where Google shows it instead. A Maps
// URL needs no key: https://developers.google.com/maps/documentation/urls.
//
// Searched by the name on the sign and the city, not by coordinates: a
// coordinate search drops a pin, while a name search opens the place's own
// page, which is the one with the stars.
export function googleMapsUrl(card: {
  name: string;
  localName: string | null;
  city: string;
}): string {
  const query = `${card.localName ?? card.name}, ${card.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function feeLabel(fee: boolean | null): string | null {
  if (fee === false) return "כניסה חופשית";
  if (fee === true) return "בתשלום";
  return null;
}

// "45-60 דק׳", as the export writes it. A plain hyphen and not an en dash on
// purpose: the bidi algorithm keeps "45-60" one left-to-right run, while an en
// dash is a neutral and in a Hebrew line it turns the range around to "60–45".
export function visitLabel([from, to]: [number, number]): string {
  if (from >= 60 && to % 60 === 0 && from % 60 === 0) {
    return `${from / 60}-${to / 60} שע׳`;
  }
  return `${from}-${to} דק׳`;
}

// A country's flag from its ISO code: two regional-indicator letters.
export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) return "📍";
  return [...countryCode.toUpperCase()]
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join("");
}

export const discoverRequestSchema = z.object({
  tripId: z.uuid(),
  // One city, or every city of one country — capped, because each is its own
  // Overpass query.
  cities: z.array(z.string().trim().min(1).max(120)).min(1).max(4),
  category: discoverCategorySchema,
});
