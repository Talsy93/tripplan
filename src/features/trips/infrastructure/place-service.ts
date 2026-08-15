import { createClient } from "@/lib/supabase/server";
import { normaliseName } from "@/lib/text";
import { manualPlaceDescription } from "../domain/place";
import type { ManualPlaceInput, Place } from "../domain/place";

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

// Adds a place the user typed in by hand.
//
// Deliberately NOT an upsert, unlike addPlaceToTrip above. The natural key is
// (trip_id, city, category, name), so a typed name can collide with a row that
// already exists — and a blind upsert would overwrite that row's `source`,
// `external_id` and coordinates with a typed row's empty ones. Flipping an 'ai'
// row to 'manual' would drop it out of the city guide (getSavedCityGuide
// filters on source) and out of deleteCityGuide's reach; nulling an
// external_id would break the search's "already added" badge. Both would fail
// silently, which is how the source-filter bugs in stage 13b behaved.
//
// So: an existing row is only marked selected, and told its address if one was
// given. Nothing already known about it is rewritten.
export async function addManualPlace(
  tripId: string,
  input: ManualPlaceInput,
): Promise<{ ok: boolean; existed: boolean }> {
  const supabase = await createClient();
  const description = manualPlaceDescription(input.address);

  const key = {
    trip_id: tripId,
    city: input.city,
    category: input.category,
    name: input.name,
  };

  const { data: existing } = await supabase
    .from("suggested_destinations")
    .select("id")
    .match(key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("suggested_destinations")
      .update({ selected: true, ...(description ? { description } : {}) })
      .eq("id", existing.id);

    if (error) {
      console.error("addManualPlace update failed:", error.message);
      return { ok: false, existed: true };
    }
    return { ok: true, existed: true };
  }

  // Coordinates and external_id are left unset on purpose. A typed place has
  // no OSM element behind it, and geocoding a business name is the bug that
  // put "Hakone" in Los Angeles (see migration 0005) — so the map and the
  // distance-between-stops calculation simply skip it, the same way they
  // already skip every AI guide item.
  const { error } = await supabase.from("suggested_destinations").insert({
    ...key,
    description,
    source: "manual" as const,
    selected: true,
  });

  if (error) {
    // 23505 = unique violation: something inserted the same row in between.
    // Treat it as "it exists now", which is what the caller wanted anyway.
    if (error.code === "23505") {
      const { error: retryError } = await supabase
        .from("suggested_destinations")
        .update({ selected: true, ...(description ? { description } : {}) })
        .match(key);
      if (!retryError) return { ok: true, existed: true };
    }
    console.error("addManualPlace insert failed:", error.message);
    return { ok: false, existed: false };
  }
  return { ok: true, existed: false };
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
