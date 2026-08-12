import { createClient } from "@/lib/supabase/server";
import type { AiTripPlan } from "../domain/trip-plan";

// Sentinel category holding a city's overview row — see guide-service.ts. The
// route map caches the city's coordinates on it, so a city added here needs
// one or it gets re-geocoded on every page load.
const OVERVIEW_CATEGORY = "overview";

// Writes a plan extracted from the conversation into the trip.
//
// Purely additive. saveCities(), the existing path for city suggestions,
// deletes what's there before writing — correct when the user asked to
// regenerate suggestions, wrong here: a conversation should not be able to
// remove destinations the user already committed to.
//
// Items land as selected, because the point of building a plan from the chat
// is that these are the things being taken along. They show up in "what you
// picked", on the route map and in the itinerary builder, and can be removed
// there one by one like anything else.
export async function savePlanFromChat(tripId: string, plan: AiTripPlan) {
  const supabase = await createClient();

  const cityRows = plan.cities.map((city) => ({
    trip_id: tripId,
    name: city.name,
    description: city.intro,
    source: "ai" as const,
    selected: false,
  }));

  const overviewRows = plan.cities.map((city) => ({
    trip_id: tripId,
    city: city.name,
    category: OVERVIEW_CATEGORY,
    name: city.name,
    description: city.intro,
    source: "ai" as const,
    selected: false,
  }));

  const itemRows = plan.cities.flatMap((city) =>
    city.items.map((item) => ({
      trip_id: tripId,
      city: city.name,
      category: item.category,
      name: item.name,
      description: item.description,
      source: "ai" as const,
      selected: true,
    })),
  );

  // City-level rows carry a null category, which the unique index treats as
  // never conflicting — so they're inserted only when the city is new.
  const existingCities = await getSuggestedCityNames(tripId);
  const newCityRows = cityRows.filter((row) => !existingCities.has(row.name));
  if (newCityRows.length > 0) {
    const { error } = await supabase
      .from("suggested_destinations")
      .insert(newCityRows);
    if (error) {
      console.error("savePlanFromChat (cities) failed:", error.message);
      return false;
    }
  }

  // Overview rows must not clobber an existing city's saved intro.
  if (overviewRows.length > 0) {
    const { error } = await supabase
      .from("suggested_destinations")
      .upsert(overviewRows, {
        onConflict: "trip_id,city,category,name",
        ignoreDuplicates: true,
      });
    if (error) {
      console.error("savePlanFromChat (overviews) failed:", error.message);
      return false;
    }
  }

  // Items, in contrast, do overwrite: re-running the plan should mark an item
  // selected even if a previous guide had it sitting there unselected.
  if (itemRows.length > 0) {
    const { error } = await supabase
      .from("suggested_destinations")
      .upsert(itemRows, { onConflict: "trip_id,city,category,name" });
    if (error) {
      console.error("savePlanFromChat (items) failed:", error.message);
      return false;
    }
  }

  return true;
}

async function getSuggestedCityNames(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suggested_destinations")
    .select("name")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .is("category", null);

  return new Set((data ?? []).map((row) => row.name));
}
