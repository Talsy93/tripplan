import { createClient } from "@/lib/supabase/server";
import { tripMapPlaceSchema } from "../domain/trip-map";
import type { TripMapPlace } from "../domain/trip-map";

// The city's own overview row (see guide-service) is the city, not a place in
// it — the map already has the city from getCachedStopsByTrip.
const OVERVIEW_CATEGORY = "overview";

// Every saved destination of one trip that has coordinates, for the home map's
// "open this trip" view.
//
// One trip at a time, on demand, rather than every trip's places with the
// page: the home is read on every visit and most visits never open a trip on
// the map. RLS scopes it — a trip the caller is not a member of returns no
// rows, whatever id is passed.
//
// A null category is kept: those are the destinations chosen in planning mode,
// which are exactly "saved destinations". `.neq` alone would drop them, since
// NULL <> 'overview' is not true in SQL.
export async function getTripMapPlaces(
  tripId: string,
): Promise<TripMapPlace[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("name, city, category, latitude, longitude")
    .eq("trip_id", tripId)
    .eq("selected", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .or(`category.is.null,category.neq.${OVERVIEW_CATEGORY}`)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("getTripMapPlaces failed:", error.message);
    return null;
  }
  return data.flatMap((row) => {
    const parsed = tripMapPlaceSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
