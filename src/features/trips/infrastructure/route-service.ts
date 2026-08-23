import { createClient } from "@/lib/supabase/server";
import { geocodePlace, geocodePlaces, reverseCountries } from "@/lib/geocode";
import { orderByProximity } from "@/lib/geo";
import { dominantCountry, itineraryStops } from "../domain/route";
import { isSchemaOutOfDate } from "./itinerary-service";
import type { RouteStop, TripRoute } from "../domain/route";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { CountryInfo, Coordinates } from "@/lib/geocode";

// The sentinel row saveCityGuide() writes per city (see guide-service.ts). It
// is the natural home for the city's cached coordinates: exactly one row per
// (trip, city), and it exists whenever the user has a guide for that city.
const OVERVIEW_CATEGORY = "overview";

// Builds the trip's route: every city the user added something in, with
// coordinates for the map.
//
// Stops follow the itinerary's day order when there is an itinerary, and
// otherwise the order the cities were added — so the map is useful during
// planning, before any itinerary exists.
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
  itinerary: ItineraryDay[] = [],
): Promise<TripRoute> {
  const cities = orderCities(await getRouteCities(tripId), itinerary);
  if (cities.length === 0) {
    return { stops: [], unlocatedCities: [], repairedCities: [] };
  }

  const cityNames = cities.map((c) => c.city);
  const cached = await getCachedLocations(tripId, cityNames);

  const missing = cityNames.filter((city) => !cached.has(city));
  if (missing.length > 0) {
    const geocoded = await geocodePlaces(missing, tripName);
    for (const [city, coords] of geocoded) {
      cached.set(city, { ...coords, country: null, countryCode: null });
    }
    await cacheCoordinates(tripId, geocoded);
  }

  // Countries are looked up once per city and cached, both to group the route
  // by country and to judge whether a pin is plausible at all — see below.
  await fillMissingCountries(tripId, cached);
  const repairedCities = await repairMisplacedCities(tripId, cities, cached);

  const stops: RouteStop[] = [];
  const unlocatedCities: string[] = [];

  for (const { city, itemCount, nights, days } of cities) {
    const found = cached.get(city);
    if (found) {
      stops.push({
        city,
        latitude: found.latitude,
        longitude: found.longitude,
        country: found.country,
        countryCode: found.countryCode,
        itemCount,
        nights,
        days,
      });
    } else {
      unlocatedCities.push(city);
    }
  }
  return {
    stops: withProximityOrderedTail(stops),
    unlocatedCities,
    repairedCities,
  };
}

// Cities the itinerary has scheduled keep their day order untouched — those
// days are decided and reordering them would contradict the schedule. Only the
// tail, cities added but never scheduled, gets sorted by proximity, because
// its order is otherwise just "whenever I happened to add this" and that is
// what produced a route doubling back on itself.
//
// The tail is seeded from the last scheduled stop when there is one, so the
// first unscheduled city is the one nearest to where the trip already ends
// rather than the nearest to itself.
function withProximityOrderedTail(stops: RouteStop[]): RouteStop[] {
  const scheduled = stops.filter((stop) => stop.days.length > 0);
  const tail = stops.filter((stop) => stop.days.length === 0);
  if (tail.length < 2) return stops;

  const anchor = scheduled[scheduled.length - 1];
  if (!anchor) return [...orderByProximity(tail)];

  // Ordering [anchor, ...tail] and dropping the anchor is the same as
  // nearest-neighbour starting from it, without giving orderByProximity a
  // second parameter that only one caller would ever use.
  const ordered = orderByProximity([anchor, ...tail]).slice(1);
  return [...scheduled, ...ordered];
}

type CityLocation = Coordinates & {
  country: string | null;
  countryCode: string | null;
};

// Reverse-geocodes any city that has coordinates but no country yet, and
// caches the answer. Cheap over time: it runs once per city, ever.
async function fillMissingCountries(
  tripId: string,
  located: Map<string, CityLocation>,
) {
  const needed = new Map<string, Coordinates>();
  for (const [city, place] of located) {
    if (place.countryCode) continue;
    needed.set(city, { latitude: place.latitude, longitude: place.longitude });
  }
  if (needed.size === 0) return;

  const countries = await reverseCountries(needed);
  for (const [city, country] of countries) {
    const place = located.get(city);
    if (place) {
      place.country = country.name;
      place.countryCode = country.code;
    }
  }
  await cacheCountries(tripId, countries);
}

// Re-resolves a city whose pin landed in a country the rest of the trip is
// nowhere near — the "map is broken, some destinations are wrong" report.
//
// The failure it fixes is documented in lib/geocode.ts: a Hebrew city name is
// searched as free text, and an obscure one can match an article or an OSM
// entry on the other side of the world ("האקונה" resolving to an office in Los
// Angeles). Once every city has a country, that mistake is obvious rather than
// invisible — a trip whose other five cities are all in Japan says plainly that
// the sixth is wrong.
//
// The retry passes the agreed country as context, which is far stronger than
// the trip name the first attempt used ("יפן 2026" has its digits stripped and
// may not name a country at all). A retry that still lands outside the country
// is discarded and the original pin kept: an unexplained move is worse than a
// wrong one the user can see and report.
//
// Returns the cities that were moved, so the map can say so — a pin that
// silently relocates between two visits is its own kind of broken.
async function repairMisplacedCities(
  tripId: string,
  cities: OrderedCity[],
  located: Map<string, CityLocation>,
): Promise<string[]> {
  const withCountry = cities
    .map((c) => located.get(c.city))
    .filter((place): place is CityLocation => place !== undefined);

  // Below three cities there is no majority to appeal to, and a genuine
  // two-country trip must not have half of it "repaired" into the other half.
  if (withCountry.length < 3) return [];

  const dominant = dominantCountry(withCountry);
  if (!dominant) return [];

  const dominantName = withCountry.find(
    (place) => place.countryCode === dominant,
  )?.country;
  if (!dominantName) return [];

  const repaired: string[] = [];
  for (const { city } of cities) {
    const place = located.get(city);
    if (!place?.countryCode || place.countryCode === dominant) continue;

    const retry = await geocodePlace(city, dominantName);
    if (!retry) continue;

    const country = (await reverseCountries(new Map([[city, retry]]))).get(city);
    if (country?.code !== dominant) continue;

    place.latitude = retry.latitude;
    place.longitude = retry.longitude;
    place.country = country.name;
    place.countryCode = country.code;

    await cacheCoordinates(tripId, new Map([[city, retry]]));
    await cacheCountries(tripId, new Map([[city, country]]));
    repaired.push(city);
    console.warn(
      `[route] "${city}" was geocoded outside ${dominantName} and has been re-resolved`,
    );
  }
  return repaired;
}

type OrderedCity = {
  city: string;
  itemCount: number;
  nights: number;
  days: number[];
};

// Puts the trip's cities in visiting order and attaches their nights.
//
// Cities the itinerary schedules come first, in day order. A city the user
// added things in but never scheduled still belongs on the map, so it follows
// afterwards with no nights.
function orderCities(
  cities: { city: string; itemCount: number }[],
  itinerary: ItineraryDay[],
): OrderedCity[] {
  const itemCounts = new Map(cities.map((c) => [c.city, c.itemCount]));
  const scheduled = itineraryStops(itinerary);

  const ordered: OrderedCity[] = scheduled
    .filter((stop) => itemCounts.has(stop.city))
    .map((stop) => ({
      city: stop.city,
      itemCount: itemCounts.get(stop.city) ?? 0,
      nights: stop.nights,
      days: stop.days,
    }));

  const placed = new Set(ordered.map((stop) => stop.city));
  for (const { city, itemCount } of cities) {
    if (!placed.has(city)) {
      ordered.push({ city, itemCount, nights: 0, days: [] });
    }
  }
  return ordered;
}

// Distinct cities the user added things in, in order of first addition, with
// how many things they added in each.
//
// Not filtered by source: a city the user only added places to from the
// attractions search still belongs on the map.
async function getRouteCities(
  tripId: string,
): Promise<{ city: string; itemCount: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("city")
    .eq("trip_id", tripId)
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

// One city's coordinates, for anything that needs to search around it.
//
// Reads the same cache the route map fills, and geocodes on a miss so the
// caller works even for a city the map hasn't drawn yet.
export async function getCityCenter(
  tripId: string,
  city: string,
  tripName?: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const cached = await getCachedLocations(tripId, [city]);
  const hit = cached.get(city);
  if (hit) return { latitude: hit.latitude, longitude: hit.longitude };

  const geocoded = await geocodePlaces([city], tripName);
  const coords = geocoded.get(city);
  if (!coords) return null;

  await cacheCoordinates(tripId, geocoded);
  return coords;
}

async function getCachedLocations(tripId: string, cities: string[]) {
  const supabase = await createClient();

  const read = (columns: string) =>
    supabase
      .from("suggested_destinations")
      .select(columns)
      .eq("trip_id", tripId)
      .eq("category", OVERVIEW_CATEGORY)
      .in("city", cities);

  // `country` arrived in migration 0015 and code can reach production before a
  // migration is run — the same situation getItinerary already handles for
  // 0013's travel columns. Without the column the map still draws; it just
  // cannot group by country until the migration lands.
  let { data, error } = await read("city, latitude, longitude, country");
  if (error && isSchemaOutOfDate(error.message)) {
    console.error(
      "getCachedLocations: country column missing, migration 0015 not applied yet",
    );
    ({ data, error } = await read("city, latitude, longitude"));
  }

  const cached = new Map<string, CityLocation>();
  if (error || !data) return cached;

  for (const row of data as unknown as Record<string, unknown>[]) {
    const city = row.city as string | null;
    const latitude = row.latitude as number | null;
    const longitude = row.longitude as number | null;
    if (!city || typeof latitude !== "number" || typeof longitude !== "number") {
      continue;
    }
    // The country column stores "code|name" so one column carries both the
    // display name and the comparable code. A column each would have been two
    // migrations' worth of schema for a value that is always read together.
    const stored = (row.country as string | null) ?? null;
    const [code, ...nameParts] = stored ? stored.split("|") : [];
    cached.set(city, {
      latitude,
      longitude,
      country: nameParts.length > 0 ? nameParts.join("|") : null,
      countryCode: code || null,
    });
  }
  return cached;
}

async function cacheCountries(
  tripId: string,
  countries: Map<string, CountryInfo>,
) {
  if (countries.size === 0) return;

  const supabase = await createClient();
  for (const [city, country] of countries) {
    const { error } = await supabase
      .from("suggested_destinations")
      .update({ country: `${country.code}|${country.name}` })
      .eq("trip_id", tripId)
      .eq("category", OVERVIEW_CATEGORY)
      .eq("city", city);
    if (error) {
      // Best-effort, like cacheCoordinates: the route renders from the fresh
      // lookup either way, and a missing 0015 must not break the map.
      console.error(`cacheCountries failed for ${city}:`, error.message);
    }
  }
}

// Clears the cached coordinates and country for a trip's cities, so the next
// render resolves them again through the improved path. The escape hatch for a
// pin the automatic repair could not fix — migration 0005 did the same thing
// once, globally, for the same class of bug.
export async function resetTripLocations(tripId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("suggested_destinations")
    .update({ latitude: null, longitude: null, country: null })
    .eq("trip_id", tripId)
    .eq("category", OVERVIEW_CATEGORY);

  if (error) {
    console.error("resetTripLocations failed:", error.message);
    return false;
  }
  return true;
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
