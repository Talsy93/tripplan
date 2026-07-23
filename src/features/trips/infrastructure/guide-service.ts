import { createClient } from "@/lib/supabase/server";
import type {
  AiCategoryKey,
  AiCitySuggestion,
  AiCityGuide,
  AiRecommendation,
} from "../domain/ai-suggestion";

const CATEGORY_KEYS: AiCategoryKey[] = [
  "hotels",
  "restaurants",
  "attractions",
  "experiences",
];

function emptyGuide(): AiCityGuide {
  return { hotels: [], restaurants: [], attractions: [], experiences: [] };
}

// Loads a previously saved AI guide for (trip, city), grouped by category.
// Returns null when nothing is stored yet, so callers know to generate.
export async function getSavedCityGuide(
  tripId: string,
  city: string,
): Promise<AiCityGuide | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("category, name, description, tip")
    .eq("trip_id", tripId)
    .eq("city", city)
    .eq("source", "ai")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  const guide = emptyGuide();
  for (const row of data) {
    const key = row.category as AiCategoryKey;
    if (guide[key]) {
      guide[key].push({
        name: row.name,
        description: row.description ?? "",
        tip: row.tip ?? "",
      });
    }
  }
  return guide;
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
  if (rows.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("suggested_destinations")
    .upsert(rows, {
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

// Replaces the trip's suggested cities with a freshly generated set.
export async function saveCities(
  tripId: string,
  cities: AiCitySuggestion[],
) {
  const supabase = await createClient();
  await supabase
    .from("suggested_destinations")
    .delete()
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .is("category", null);

  if (cities.length === 0) return;

  const rows = cities.map((city) => ({
    trip_id: tripId,
    name: city.name,
    description: city.description,
    source: "ai" as const,
    selected: false,
  }));
  const { error } = await supabase
    .from("suggested_destinations")
    .insert(rows);
  if (error) {
    console.error("saveCities failed:", error.message);
  }
}
