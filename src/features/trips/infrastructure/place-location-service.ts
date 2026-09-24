import { createClient } from "@/lib/supabase/server";
import { geocodeAddress, geocodePlaceInCity } from "@/lib/geocode";
import type { Coordinates } from "@/lib/geocode";
import { isSchemaOutOfDate } from "@/lib/supabase/schema-errors";
import { normaliseName } from "@/lib/text";
import { getCityCenter } from "./route-service";

// Placing one destination the map could not pin — a saved place or a schedule
// entry — either by searching for that place inside its city, or from an
// address the traveller typed when the search came back empty.
//
// Where the answer is written, and why in two places:
//
//   - On every saved place with that name in that city (suggested_destinations,
//     'overview' rows excluded — they are the city centre). That is what the
//     schedule already matches its entries against, so the pin shows on the
//     day's map, the planning map and the full map at once, and a rebuilt
//     schedule keeps it.
//   - On the schedule entry itself when one was named (migration 0027), for an
//     entry no saved place stands behind — one typed straight into the day.
//
// The name in the trip is never changed. Only the position is written.

export type LocateOutcome =
  | { ok: true; point: Coordinates }
  | { ok: false; reason: "not-found" | "migration" | "failed" };

export async function locateTripPlace(
  tripId: string,
  target: { name: string; city: string | null; itemId?: string; address?: string },
  tripName?: string,
): Promise<LocateOutcome> {
  const city = target.city?.trim() || null;
  const near = city ? await getCityCenter(tripId, city, tripName) : null;

  const point = target.address
    ? await geocodeAddress(target.address, city ?? "", near)
    : await geocodePlaceInCity(target.name, city ?? "", near);
  if (!point) return { ok: false, reason: "not-found" };

  const supabase = await createClient();

  // Saved places with this name in this city. Compared normalised, the same key
  // itinerary-service uses to match an entry to its place.
  let rows = supabase
    .from("suggested_destinations")
    .select("id, name")
    .eq("trip_id", tripId)
    .neq("category", "overview");
  rows = city ? rows.eq("city", city) : rows.is("city", null);
  const { data: candidates, error: readError } = await rows;
  if (readError) {
    console.error("locateTripPlace: read failed:", readError.message);
    return { ok: false, reason: "failed" };
  }

  const wanted = normaliseName(target.name);
  const ids = (candidates ?? [])
    .filter((row) => normaliseName(row.name as string) === wanted)
    .map((row) => row.id as string);

  let wrote = false;
  if (ids.length > 0) {
    const { error } = await supabase
      .from("suggested_destinations")
      .update({ latitude: point.latitude, longitude: point.longitude })
      .in("id", ids);
    if (error) {
      console.error("locateTripPlace: place update failed:", error.message);
    } else {
      wrote = true;
    }
  }

  if (target.itemId) {
    const { error } = await supabase
      .from("itinerary_items")
      .update({ latitude: point.latitude, longitude: point.longitude })
      .eq("id", target.itemId)
      .eq("trip_id", tripId);
    if (error) {
      if (isSchemaOutOfDate(error.message)) {
        // Without 0027 an entry with no saved place behind it has nowhere to
        // keep a position. When a saved place took it, that is enough.
        if (!wrote) return { ok: false, reason: "migration" };
      } else {
        console.error("locateTripPlace: entry update failed:", error.message);
        if (!wrote) return { ok: false, reason: "failed" };
      }
    } else {
      wrote = true;
    }
  }

  return wrote ? { ok: true, point } : { ok: false, reason: "failed" };
}
