import { createClient } from "@/lib/supabase/server";
import { geocodePlaces } from "@/lib/geocode";
import type { RouteStop, TripRoute } from "../domain/route";

// The sentinel row saveCityGuide() writes per city (see guide-service.ts). It
// is the natural home for the city's cached coordinates: exactly one row per
// (trip, city), and it exists whenever the user has a guide for that city.
const OVERVIEW_CATEGORY = "overview";

// Builds the trip's route: every city the user added something in, ordered by
// when it entered the trip, with coordinates for the map.
//
// `tripName` is passed to the geocoder as context — city names arrive in
// Hebrew and are ambiguous on their own, so the trip's name (which usually
// carries the country) keeps lookups in the right part of the world.
//
// Coordinates are cached in suggested_destinations.latitude/longitude. Only
// cities missing them are looked up, so a repeat visit does no network work.
export async function getTripRoute(
  tripId: string,
  tripName?: string,
): Promise<TripRoute> {
  const cities = await getRouteCities(tripId);
  if (cities.length === 0) {
    return { stops: [], unlocatedCities: [] };
  }

  const cached = await getCachedCoordinates(
    tripId,
    cities.map((c) => c.city),
  );

  const missing = cities
    .map((c) => c.city)
    .filter((city) => !cached.has(city));

  if (missing.length > 0) {
    const geocoded = await geocodePlaces(missing, tripName);
    for (const [city, coords] of geocoded) {
      cached.set(city, coords);
    }
    await cacheCoordinates(tripId, geocoded);
  }

  const stops: RouteStop[] = [];
  const unlocatedCities: string[] = [];

  for (const { city, itemCount } of cities) {
    const coords = cached.get(city);
    if (coords) {
      stops.push({ city, ...coords, itemCount });
    } else {
      unlocatedCities.push(city);
    }
  }
  return { stops, unlocatedCities };
}

// Distinct cities the user added things in, in order of first addition, with
// how many things they added in each.
async function getRouteCities(
  tripId: string,
): Promise<{ city: string; itemCount: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("city")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .eq("selected", true)
    .not("category", "is", null)
    .not("city", "is", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data) {
    const city = row.city;
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  // Map preserves insertion order, which is the created_at order above.
  return [...counts].map(([city, itemCount]) => ({ city, itemCount }));
}

async function getCachedCoordinates(tripId: string, cities: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("city, latitude, longitude")
    .eq("trip_id", tripId)
    .eq("category", OVERVIEW_CATEGORY)
    .in("city", cities);

  const cached = new Map<string, { latitude: number; longitude: number }>();
  if (error || !data) return cached;

  for (const row of data) {
    if (
      row.city &&
      typeof row.latitude === "number" &&
      typeof row.longitude === "number"
    ) {
      cached.set(row.city, {
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }
  return cached;
}

async function cacheCoordinates(
  tripId: string,
  coords: Map<string, { latitude: number; longitude: number }>,
) {
  if (coords.size === 0) return;

  const supabase = await createClient();
  for (const [city, { latitude, longitude }] of coords) {
    const { error } = await supabase
      .from("suggested_destinations")
      .update({ latitude, longitude })
      .eq("trip_id", tripId)
      .eq("category", OVERVIEW_CATEGORY)
      .eq("city", city);
    if (error) {
      // Caching is best-effort: the map still renders from the fresh lookup.
      console.error(`cacheCoordinates failed for ${city}:`, error.message);
    }
  }
}
