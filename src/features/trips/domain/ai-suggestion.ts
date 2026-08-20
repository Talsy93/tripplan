import * as z from "zod";
import { distanceKm } from "@/lib/geo";
import { normaliseName } from "@/lib/text";

// ---- Level 1: city / area suggestions (concise) ----------------------------

export const aiSuggestRequestSchema = z.object({
  prompt: z.string().trim().min(3, { error: "יש לתאר את הבקשה." }),
  count: z.number().int().min(1).max(10).optional(),
  // Cities already on screen, so "more destinations" gets new ones instead of
  // the same five reworded. Mirrors aiMoreRecommendationsRequestSchema below,
  // which has had this since stage 8 — level 1 simply never grew the same
  // affordance.
  exclude: z.array(z.string()).optional(),
});
export type AiSuggestRequest = z.infer<typeof aiSuggestRequestSchema>;

export const aiCitySuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
});
export type AiCitySuggestion = z.infer<typeof aiCitySuggestionSchema>;

export const aiCitySuggestionsSchema = z.object({
  cities: z.array(aiCitySuggestionSchema),
});
export type AiCitySuggestions = z.infer<typeof aiCitySuggestionsSchema>;

// Appends newly suggested cities to the ones already held, dropping anything
// that is already there.
//
// This is not belt-and-braces over a database constraint — for level-1 city rows
// there is no constraint to lean on. The unique index from migration 0003 covers
// (trip_id, city, category, name), and these rows carry NULL for both city and
// category; Postgres treats NULLs as distinct, so the index never fires for them
// (the migration's own comment says as much). Deduping here is the only thing
// standing between "more destinations" and the same city listed twice.
//
// Incoming duplicates are also collapsed against each other, because one AI
// response can name the same place twice on its own.
export function mergeCitySuggestions(
  existing: AiCitySuggestion[],
  incoming: AiCitySuggestion[],
): AiCitySuggestion[] {
  const seen = new Set(existing.map((city) => normaliseName(city.name)));
  const merged = [...existing];

  for (const city of incoming) {
    const key = normaliseName(city.name);
    // An unnamed suggestion is not a destination; it would render as a blank
    // card that cannot be opened.
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(city);
  }
  return merged;
}

// Just the cities from `incoming` that are not already in `existing` — what a
// write needs, as opposed to what the screen needs.
export function newCitySuggestions(
  existing: AiCitySuggestion[],
  incoming: AiCitySuggestion[],
): AiCitySuggestion[] {
  return mergeCitySuggestions(existing, incoming).slice(existing.length);
}

// Two points count as the same destination when they're this close — close
// enough that they're the same trip stop, not two. Tokyo's wards span a few
// kilometres each and its whole metro area is on the order of 40km across, so
// 30km catches "Shibuya" as part of "Tokyo" without also swallowing genuinely
// separate nearby cities (Kyoto/Osaka are about 40km apart).
//
// This is the backstop, not the primary defence: the AI prompt is asked
// directly not to suggest a neighbourhood of a city already on the list.
// Coordinates are not always available (geocoding a name can fail, or simply
// hasn't been tried yet) — when either point is missing, the caller should
// treat the two as different rather than call this at all.
export const DISTRICT_MERGE_RADIUS_KM = 30;

export function isSameDestination(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return distanceKm(a, b) <= DISTRICT_MERGE_RADIUS_KM;
}

// The brief a "more destinations" round runs under, or null when there is
// nothing to ask about.
//
// The original prompt is never stored — suggestions are, the request that made
// them is not. So on a later visit the list is there and the brief is gone, and
// requiring one would leave the button missing exactly when the trip is most
// likely to want more. The cities themselves are a usable brief: the AI can read
// a region and a style off "Kyoto, Osaka, Takayama" perfectly well, and the
// caller sends the same names as `exclude` anyway.
export function moreCitiesPrompt(
  userPrompt: string,
  cities: AiCitySuggestion[],
): string | null {
  const typed = userPrompt.trim();
  if (typed.length >= 3) return typed;

  const names = cities
    .map((city) => city.name.trim())
    .filter(Boolean);
  if (names.length === 0) return null;

  return `טיול באותו אזור ובאותו סגנון כמו היעדים האלה: ${names.join(", ")}`;
}

// ---- Level 2: full city guide (categorized recommendations) ----------------

export const aiCityGuideRequestSchema = z.object({
  city: z.string().trim().min(2, { error: "יש לציין עיר." }),
  context: z.string().trim().optional(),
});
export type AiCityGuideRequest = z.infer<typeof aiCityGuideRequestSchema>;

export const aiRecommendationSchema = z.object({
  name: z.string(),
  description: z.string(),
  tip: z.string(),
});
export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;

export const aiCityGuideSchema = z.object({
  // A few sentences of background on the city + how to get there.
  intro: z.string(),
  getting_there: z.string(),
  // "areas" = neighbourhoods to stay in, characterised by their vibe.
  areas: z.array(aiRecommendationSchema),
  restaurants: z.array(aiRecommendationSchema),
  attractions: z.array(aiRecommendationSchema),
  experiences: z.array(aiRecommendationSchema),
});
export type AiCityGuide = z.infer<typeof aiCityGuideSchema>;

// A guide item as loaded from the DB, carrying whether it was added to the trip.
export type GuideItem = AiRecommendation & { selected: boolean };
export type SavedCityGuide = Record<AiCategoryKey, GuideItem[]>;

// The full saved guide for a city: overview text + categorised sections.
export type CityGuideData = {
  intro: string;
  gettingThere: string;
  sections: SavedCityGuide;
};

// An item the user added to the trip (for the trip page).
export type SelectedItem = {
  city: string;
  category: string;
  name: string;
  description: string;
};

// The four guide categories; also used to request more of a single one.
export const aiCategoryKeySchema = z.enum([
  "areas",
  "restaurants",
  "attractions",
  "experiences",
]);
export type AiCategoryKey = z.infer<typeof aiCategoryKeySchema>;

// Request for more recommendations in one category, excluding what's shown.
export const aiMoreRecommendationsRequestSchema = z.object({
  city: z.string().trim().min(2, { error: "יש לציין עיר." }),
  category: aiCategoryKeySchema,
  context: z.string().trim().optional(),
  exclude: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(8).optional(),
});
export type AiMoreRecommendationsRequest = z.infer<
  typeof aiMoreRecommendationsRequestSchema
>;

export const aiRecommendationsSchema = z.object({
  recommendations: z.array(aiRecommendationSchema),
});
export type AiRecommendations = z.infer<typeof aiRecommendationsSchema>;

// ---- Itinerary: an AI-built day-by-day schedule ----------------------------

export const aiItineraryRequestSchema = z.object({
  tripId: z.uuid(),
});
export type AiItineraryRequest = z.infer<typeof aiItineraryRequestSchema>;

export const aiItineraryEntrySchema = z.object({
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  note: z.string(),
});
export const aiItineraryDaySchema = z.object({
  day: z.number().int(),
  items: z.array(aiItineraryEntrySchema),
});
export const aiItinerarySchema = z.object({
  days: z.array(aiItineraryDaySchema),
});
export type AiItinerary = z.infer<typeof aiItinerarySchema>;

// The itinerary as loaded from the DB, for display on the trip page.
export type ItineraryEntry = {
  id: string;
  title: string;
  startLabel: string;
  endLabel: string;
  note: string;
  // The city this item was picked in. Null when the AI renamed the item and it
  // could no longer be matched back to a guide item — such an entry still
  // shows in the itinerary, it just can't be placed on the map.
  city: string | null;
  // Where the place is, when known. Only items that came from the attractions
  // search carry coordinates — an AI guide item is a name and nothing more —
  // so this is null for most entries and the timeline has to cope.
  latitude: number | null;
  longitude: number | null;
  // How to get here and how long it takes, in the user's own words. The app
  // cannot work this out — a straight-line distance needs coordinates at both
  // ends, and free public-transport routing does not exist as an API — so these
  // are typed in once rather than looked up again on the day.
  travelNote: string | null;
  travelMinutes: number | null;
};
export type ItineraryDay = {
  day: number;
  items: ItineraryEntry[];
};
