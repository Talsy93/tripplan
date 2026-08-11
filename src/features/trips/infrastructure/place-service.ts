import { createClient } from "@/lib/supabase/server";
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

// The OSM ids already added to this trip, so the search can mark them.
export async function getAddedPlaceIds(tripId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("external_id")
    .eq("trip_id", tripId)
    .eq("source", "manual")
    .eq("selected", true)
    .not("external_id", "is", null);

  if (error || !data) return new Set();
  return new Set(
    data
      .map((row) => row.external_id)
      .filter((id): id is string => typeof id === "string"),
  );
}
