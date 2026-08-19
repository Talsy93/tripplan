import { createClient } from "@/lib/supabase/server";
import { geocodePlaces } from "@/lib/geocode";
import {
  DISTRICT_MERGE_RADIUS_KM,
  isSameDestination,
  newCitySuggestions,
} from "../domain/ai-suggestion";
import { getTrip } from "./trips-service";
import type {
  AiCategoryKey,
  AiCitySuggestion,
  AiCityGuide,
  AiRecommendation,
  CityGuideData,
  SavedCityGuide,
  SelectedItem,
} from "../domain/ai-suggestion";

const CATEGORY_KEYS: AiCategoryKey[] = [
  "areas",
  "restaurants",
  "attractions",
  "experiences",
];

// Sentinel category used to store the city's overview (intro + getting there)
// as a single row alongside the categorised items.
const OVERVIEW_CATEGORY = "overview";

// Loads a previously saved AI guide for (trip, city), grouped by category.
// Returns null when nothing is stored yet, so callers know to generate.
export async function getSavedCityGuide(
  tripId: string,
  city: string,
): Promise<CityGuideData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("category, name, description, tip, selected")
    .eq("trip_id", tripId)
    .eq("city", city)
    .eq("source", "ai")
    .not("category", "is", null)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  const sections: SavedCityGuide = {
    areas: [],
    restaurants: [],
    attractions: [],
    experiences: [],
  };
  let intro = "";
  let gettingThere = "";

  for (const row of data) {
    if (row.category === OVERVIEW_CATEGORY) {
      intro = row.description ?? "";
      gettingThere = row.tip ?? "";
      continue;
    }
    const key = row.category as AiCategoryKey;
    if (sections[key]) {
      sections[key].push({
        name: row.name,
        description: row.description ?? "",
        tip: row.tip ?? "",
        selected: row.selected,
      });
    }
  }
  return { intro, gettingThere, sections };
}

// Toggle whether a guide item is added to the trip. Identified by its natural
// key (the unique index guarantees one row per trip/city/category/name).
export async function setDestinationSelected(
  tripId: string,
  city: string,
  category: string,
  name: string,
  selected: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("suggested_destinations")
    .update({ selected })
    .eq("trip_id", tripId)
    .eq("city", city)
    .eq("category", category)
    .eq("name", name);
  if (error) {
    console.error("setDestinationSelected failed:", error.message);
  }
}

// Items the user added to the trip, across all cities.
//
// Both sources count: 'ai' items come from a city guide, 'manual' ones from the
// attractions search. Filtering to 'ai' here would silently drop everything the
// user found themselves — it wouldn't reach "what you picked", the route map, or
// the itinerary builder.
export async function getSelectedDestinations(
  tripId: string,
): Promise<SelectedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("city, category, name, description")
    .eq("trip_id", tripId)
    .eq("selected", true)
    .not("category", "is", null)
    .order("city", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    city: row.city ?? "",
    category: row.category ?? "",
    name: row.name,
    description: row.description ?? "",
  }));
}

// A single city that best represents the trip, for illustrating it with a
// photo. Prefers a city the user actually added; falls back to any suggested
// city; null when planning hasn't produced any city yet.
export async function getPrimaryDestination(
  tripId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data: selected } = await supabase
    .from("suggested_destinations")
    .select("city")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .eq("selected", true)
    .not("category", "is", null)
    .not("city", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selected?.[0]?.city) return selected[0].city;

  const { data: cities } = await supabase
    .from("suggested_destinations")
    .select("name")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .is("category", null)
    .order("created_at", { ascending: true })
    .limit(1);

  return cities?.[0]?.name ?? null;
}

function toRows(
  tripId: string,
  city: string,
  category: AiCategoryKey,
  items: AiRecommendation[],
) {
  return items.map((item) => ({
    trip_id: tripId,
    city,
    category,
    name: item.name,
    description: item.description,
    tip: item.tip,
    source: "ai" as const,
    selected: false,
  }));
}

export async function saveCityGuide(
  tripId: string,
  city: string,
  guide: AiCityGuide,
) {
  const rows = CATEGORY_KEYS.flatMap((key) =>
    toRows(tripId, city, key, guide[key] ?? []),
  );

  // Store the city overview (intro + getting-there) as one sentinel row.
  rows.push({
    trip_id: tripId,
    city,
    category: OVERVIEW_CATEGORY as AiCategoryKey,
    name: city,
    description: guide.intro,
    tip: guide.getting_there,
    source: "ai" as const,
    selected: false,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("suggested_destinations").upsert(rows, {
    onConflict: "trip_id,city,category,name",
    ignoreDuplicates: true,
  });
  if (error) {
    console.error("saveCityGuide failed:", error.message);
  }
}

export async function saveRecommendations(
  tripId: string,
  city: string,
  category: AiCategoryKey,
  items: AiRecommendation[],
) {
  if (items.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("suggested_destinations")
    .upsert(toRows(tripId, city, category, items), {
      onConflict: "trip_id,city,category,name",
      ignoreDuplicates: true,
    });
}

// Removes the saved AI guide for a city so it can be regenerated.
export async function deleteCityGuide(tripId: string, city: string) {
  const supabase = await createClient();
  await supabase
    .from("suggested_destinations")
    .delete()
    .eq("trip_id", tripId)
    .eq("city", city)
    .eq("source", "ai");
}

// ---- Level 1: the trip's suggested cities --------------------------------
// Stored as trip-level rows (no category), distinct from the per-city guide
// items (which carry a category).

export async function getSavedCities(
  tripId: string,
): Promise<AiCitySuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("name, description")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .is("category", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    name: row.name,
    description: row.description ?? "",
  }));
}

// Adds cities to the trip's suggestions without touching the ones already
// there — what "show more destinations" needs.
//
// Separate from saveCities below, which deletes before it writes. That is right
// for regenerating from a new prompt and wrong here, and the same distinction
// already exists one level up between saveCityGuide and savePlanFromChat.
//
// Deduping happens against what is actually in the table rather than against
// what the client had on screen, so two tabs open on the same trip cannot race
// each other into a duplicate. There is no unique index to fall back on: these
// rows carry NULL city and NULL category, and Postgres treats NULLs as distinct
// (see migration 0003's own comment), so the index never fires for them.
//
// Returns the cities actually written, so the UI can say "nothing new" instead
// of silently appearing to do nothing.
// Drops any candidate that geocodes within DISTRICT_MERGE_RADIUS_KM of a city
// already on the list — Shibuya of Tokyo, not a second destination — and of
// any *other* candidate accepted earlier in the same batch (one AI response
// can propose two districts of the same city it's never seen before).
//
// Best-effort: a name that fails to geocode is kept rather than blocking the
// whole round on one lookup, and with nothing yet on the list there is
// nothing to compare against, so the common case (a trip's very first
// cities) skips the network round trip entirely.
async function withoutNearbyDuplicates(
  tripId: string,
  existingNames: string[],
  candidates: AiCitySuggestion[],
): Promise<AiCitySuggestion[]> {
  if (candidates.length === 0) return candidates;
  if (existingNames.length === 0 && candidates.length === 1) return candidates;

  const trip = await getTrip(tripId);
  const names = [...new Set([...existingNames, ...candidates.map((c) => c.name)])];
  const coords = await geocodePlaces(names, trip?.name ?? undefined);

  const known: { latitude: number; longitude: number }[] = [];
  for (const name of existingNames) {
    const point = coords.get(name);
    if (point) known.push(point);
  }

  const kept: AiCitySuggestion[] = [];
  for (const candidate of candidates) {
    const point = coords.get(candidate.name);
    const isNearbyDuplicate =
      point !== undefined && known.some((seen) => isSameDestination(seen, point));

    if (isNearbyDuplicate) {
      console.warn(
        `[guide-service] "${candidate.name}" dropped — within ${DISTRICT_MERGE_RADIUS_KM}km of a destination already on the trip`,
      );
      continue;
    }
    kept.push(candidate);
    if (point) known.push(point);
  }
  return kept;
}

export async function appendCities(
  tripId: string,
  cities: AiCitySuggestion[],
): Promise<AiCitySuggestion[]> {
  if (cities.length === 0) return [];

  const existing = await getSavedCities(tripId);
  const newOnes = newCitySuggestions(existing, cities);
  if (newOnes.length === 0) return [];

  const additions = await withoutNearbyDuplicates(
    tripId,
    existing.map((city) => city.name),
    newOnes,
  );
  if (additions.length === 0) return [];

  const supabase = await createClient();
  const { error } = await supabase.from("suggested_destinations").insert(
    additions.map((city) => ({
      trip_id: tripId,
      name: city.name,
      description: city.description,
      source: "ai" as const,
      selected: false,
    })),
  );
  if (error) {
    console.error("appendCities failed:", error.message);
    return [];
  }
  return additions;
}

// Replaces the trip's suggested cities with a freshly generated set.
export async function saveCities(tripId: string, cities: AiCitySuggestion[]) {
  const supabase = await createClient();
  await supabase
    .from("suggested_destinations")
    .delete()
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .is("category", null);

  if (cities.length === 0) return;

  // A fresh round has no "existing" cities to compare against (they were just
  // deleted above), but the AI can still name two districts of the same
  // unfamiliar city in one response — so this still checks the batch against
  // itself.
  const deduped = await withoutNearbyDuplicates(tripId, [], cities);
  if (deduped.length === 0) return;

  const rows = deduped.map((city) => ({
    trip_id: tripId,
    name: city.name,
    description: city.description,
    source: "ai" as const,
    selected: false,
  }));
  const { error } = await supabase.from("suggested_destinations").insert(rows);
  if (error) {
    console.error("saveCities failed:", error.message);
  }
}
