import { createClient } from "@/lib/supabase/server";
import { normaliseName } from "@/lib/text";
import type { Place } from "../domain/place";

// Places found in the attractions search live in the same table as the AI
// suggestions, distinguished by source='manual' — the enum value migration 0002
// created and nothing used until now.
//
// This is deliberate rather than a new table: everything downstream ("what you
// picked", the route map, the itinerary builder) already reads
// suggested_destinations, so a manual place joins the trip through the paths
// that already work.

// Adds a searched place to the trip.
//
// Upsert on the natural key so adding the same place twice is idempotent, and
// so re-adding something previously removed flips it back on rather than
// failing. Coordinates come straight from OSM, which makes these the only rows
// in the table with coordinates that were never geocoded.
export async function addPlaceToTrip(
  tripId: string,
  city: string,
  place: Place,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("suggested_destinations").upsert(
    {
      trip_id: tripId,
      city,
      category: place.category ?? "attractions",
      name: place.name,
      description: [place.brand, place.cuisine, place.address]
        .filter(Boolean)
        .join(" · "),
      tip: place.openingHours,
      latitude: place.latitude,
      longitude: place.longitude,
      external_id: place.id,
      source: "manual" as const,
      selected: true,
    },
    { onConflict: "trip_id,city,category,name" },
  );

  if (error) {
    console.error("addPlaceToTrip failed:", error.message);
    return false;
  }
  return true;
}

// What the search needs to know about a result it has already seen added.
export type AddedPlace = {
  externalId: string;
  // Itinerary days this place is scheduled on. Empty when it's in the trip but
  // the itinerary hasn't been built (or rebuilt) since it was added.
  days: number[];
};

// The places already added to this trip, each with the days it's scheduled on.
//
// The link from a search result to a day runs result → external_id → the saved
// row's name → the itinerary entry's title. It's a name match because the AI
// builds the itinerary from names, not ids (see saveItinerary) — so both ends
// normalise through the same rule.
export async function getAddedPlaces(tripId: string): Promise<AddedPlace[]> {
  const supabase = await createClient();

  const [{ data: rows }, { data: entries }] = await Promise.all([
    supabase
      .from("suggested_destinations")
      .select("external_id, name, city")
      .eq("trip_id", tripId)
      .eq("source", "manual")
      .eq("selected", true)
      .not("external_id", "is", null),
    supabase
      .from("itinerary_items")
      .select("title, city, day_number")
      .eq("trip_id", tripId),
  ]);

  if (!rows) return [];

  // Keyed on city+name: the same chain shop can legitimately appear in two
  // cities on one trip, and they are different stops.
  const daysByKey = new Map<string, Set<number>>();
  for (const entry of entries ?? []) {
    if (!entry.title || entry.day_number == null) continue;
    const key = placeKey(entry.city, entry.title);
    const days = daysByKey.get(key) ?? new Set<number>();
    days.add(entry.day_number);
    daysByKey.set(key, days);
  }

  const added: AddedPlace[] = [];
  for (const row of rows) {
    if (typeof row.external_id !== "string") continue;
    const days = daysByKey.get(placeKey(row.city, row.name));
    added.push({
      externalId: row.external_id,
      days: days ? [...days].sort((a, b) => a - b) : [],
    });
  }
  return added;
}

function placeKey(city: string | null, name: string) {
  return `${city ?? ""}|${normaliseName(name)}`;
}
