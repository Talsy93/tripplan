import { createClient } from "@/lib/supabase/server";
import { geocodePlace, geocodePlaces, reverseCountries } from "@/lib/geocode";
import { medianPoint, orderByProximity } from "@/lib/geo";
import { isSameDestination } from "../domain/ai-suggestion";
import { dominantCountry, itineraryStops } from "../domain/route";
import { isSchemaOutOfDate } from "@/lib/supabase/schema-errors";
import type { RoutePlace, RouteStop, TripRoute } from "../domain/route";
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
    return { stops: [], places: [], unlocatedCities: [], repairedCities: [] };
  }

  const cityNames = cities.map((c) => c.city);
  const cached = await getCachedLocations(tripId, cityNames);

  // Before geocoding anything: the trip may already *know* where a city is.
  //
  // Every place added from the attractions search carries the exact
  // coordinates OpenStreetMap gave for it — the only rows in the table that
  // were never geocoded, and therefore the only ones that cannot be wrong.
  // Deriving the city's position from them replaces a guess with an
  // observation, and it is what fixes the pins that kept landing in the wrong
  // place: a name lookup can put "Hakone" in Los Angeles, but five real Tokyo
  // restaurants cannot average out to anywhere except Tokyo.
  //
  // Only used for cities that have no cached position yet, so a city the user
  // has deliberately re-resolved is not quietly overridden on the next render.
  const derived = new Map(
    [...(await deriveCityCentresFromPlaces(tripId, cityNames))].filter(
      ([city]) => !cached.has(city),
    ),
  );
  for (const [city, point] of derived) {
    cached.set(city, { ...point, country: null, countryCode: null });
  }
  await cacheCoordinates(tripId, derived);

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
    places: await getSelectedPlacePoints(tripId),
    unlocatedCities,
    repairedCities,
  };
}

// The route, from cache only — never geocoding, never writing.
//
// getTripRoute above is the full version and is the right one for the map tab:
// it looks up every city it does not already know, reverse-geocodes countries,
// repairs pins that landed in the wrong hemisphere, and caches all of it.
//
// None of that belongs on the home screen. Those lookups are Nominatim round
// trips against a free, rate-limited service, and putting them behind the first
// screen of the app means the landing page waits on a third party for cities it
// may never draw. Worse, it would run them for the *featured* trip on every
// visit, which is the one trip most likely to already be cached — spending the
// budget where it is least needed.
//
// So this reads what is already known and stops. A city without cached
// coordinates is simply absent from the result, and a trip where nothing is
// cached returns an empty array, which the caller reads as "no map to draw" and
// falls back to the light. The map tab remains the only thing that fills the
// cache, which also makes the hero honest: it shows what the app has actually
// established about the trip, not what it could look up given a moment.
export async function getCachedRouteStops(
  tripId: string,
  itinerary: ItineraryDay[] = [],
): Promise<RouteStop[]> {
  const cities = orderCities(await getRouteCities(tripId), itinerary);
  if (cities.length === 0) return [];

  const cityNames = cities.map((c) => c.city);
  const cached = await getCachedLocations(tripId, cityNames);

  // Places carry coordinates OpenStreetMap gave directly and were never
  // geocoded, so deriving a centre from them is a read, not a lookup — it
  // belongs here for the same reason it belongs in getTripRoute.
  //
  // Not cached back, unlike there. This function promises not to write, and a
  // read path that quietly persists is a read path that can fail.
  const derived = await deriveCityCentresFromPlaces(tripId, cityNames);
  for (const [city, point] of derived) {
    if (!cached.has(city)) {
      cached.set(city, { ...point, country: null, countryCode: null });
    }
  }

  const stops: RouteStop[] = [];
  for (const { city, itemCount, nights, days } of cities) {
    const found = cached.get(city);
    if (!found) continue;
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
  }
  return withProximityOrderedTail(stops);
}

// Every trip's located cities, in one query.
//
// The plural of getCachedRouteStops, and the same promise: cache only, no
// geocoding, no writes. The home screen draws all of the user's trips on one
// map, and doing that by calling the singular version per trip would be a query
// per trip — the exact shape getSelectedCitiesByTrip and
// getItineraryDayCountByTrip already exist to avoid on this screen.
//
// One query rather than two, unlike the singular path. That one reads the
// overview rows and then separately derives centres from place rows; here both
// live in the same table and the same result set, so the split happens in the
// fold below instead of over the network.
//
// Precision matters less here than there. A world map at country scale does not
// care whether Kyoto is placed at its overview coordinate or at the average of
// six restaurants in it — both land on the same pixel. What matters is that a
// trip with any located city gets a pin, so it does not silently vanish from a
// screen that is supposed to show everything.
export async function getCachedStopsByTrip(): Promise<
  Map<string, { city: string; latitude: number; longitude: number }[]>
> {
  const supabase = await createClient();
  // RLS keeps this to the caller's own trips, the same as every other
  // cross-trip read on this screen.
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("trip_id, city, category, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .not("city", "is", null);

  const byTrip = new Map<
    string,
    { city: string; latitude: number; longitude: number }[]
  >();
  if (error || !data) {
    if (error) console.error("getCachedStopsByTrip failed:", error.message);
    return byTrip;
  }

  // Two passes over one result set. An overview row is the city's own cached
  // centre and wins outright; anything else contributes to an average that is
  // only used when no overview row exists for that city.
  const centres = new Map<string, { latitude: number; longitude: number }>();
  const sums = new Map<
    string,
    { latitude: number; longitude: number; count: number }
  >();

  for (const row of data) {
    if (
      !row.trip_id ||
      !row.city ||
      typeof row.latitude !== "number" ||
      typeof row.longitude !== "number"
    ) {
      continue;
    }
    const key = `${row.trip_id}|${row.city}`;
    if (row.category === OVERVIEW_CATEGORY) {
      centres.set(key, { latitude: row.latitude, longitude: row.longitude });
      continue;
    }
    const running = sums.get(key);
    if (running) {
      running.latitude += row.latitude;
      running.longitude += row.longitude;
      running.count += 1;
    } else {
      sums.set(key, {
        latitude: row.latitude,
        longitude: row.longitude,
        count: 1,
      });
    }
  }

  for (const [key, sum] of sums) {
    if (centres.has(key)) continue;
    centres.set(key, {
      latitude: sum.latitude / sum.count,
      longitude: sum.longitude / sum.count,
    });
  }

  for (const [key, point] of centres) {
    const separator = key.indexOf("|");
    const tripId = key.slice(0, separator);
    const city = key.slice(separator + 1);
    byTrip.set(tripId, [...(byTrip.get(tripId) ?? []), { city, ...point }]);
  }
  return byTrip;
}

// The trip's selected places that have real coordinates, for pinning
// individually. Only `selected` rows: the table also holds everything the
// guide ever suggested, and drawing all of it would bury the actual plan.
async function getSelectedPlacePoints(tripId: string): Promise<RoutePlace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("name, city, latitude, longitude")
    .eq("trip_id", tripId)
    .eq("selected", true)
    .neq("category", OVERVIEW_CATEGORY)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error || !data) {
    if (error) console.error("getSelectedPlacePoints failed:", error.message);
    return [];
  }

  const places: RoutePlace[] = [];
  for (const row of data) {
    if (
      typeof row.latitude !== "number" ||
      typeof row.longitude !== "number" ||
      !row.name
    ) {
      continue;
    }
    places.push({
      name: row.name,
      city: row.city ?? "",
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }
  return places;
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

// A city's position, taken from the places the user actually added in it.
//
// These rows come from the attractions search, so their coordinates are
// OpenStreetMap's own — never geocoded, and therefore never subject to the
// name-matching failure that misplaces pins.
//
// The *median* of the points, not the mean: one place tagged at the wrong
// coordinates in OSM would drag a mean across the map, and a single outlier is
// exactly what this is meant to be robust against. Overview rows are excluded
// because their coordinates are the guess this function exists to replace.
async function deriveCityCentresFromPlaces(
  tripId: string,
  cities: string[],
): Promise<Map<string, Coordinates>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_destinations")
    .select("city, latitude, longitude")
    .eq("trip_id", tripId)
    .neq("category", OVERVIEW_CATEGORY)
    .in("city", cities)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  const byCity = new Map<string, Coordinates[]>();
  if (error || !data) {
    if (error) console.error("deriveCityCentresFromPlaces failed:", error.message);
    return new Map();
  }

  for (const row of data) {
    if (
      !row.city ||
      typeof row.latitude !== "number" ||
      typeof row.longitude !== "number"
    ) {
      continue;
    }
    byCity.set(row.city, [
      ...(byCity.get(row.city) ?? []),
      { latitude: row.latitude, longitude: row.longitude },
    ]);
  }

  const centres = new Map<string, Coordinates>();
  for (const [city, points] of byCity) {
    const centre = medianPoint(points);
    if (centre) centres.set(city, centre);
  }
  return centres;
}

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

// Resolves a district name inside a city to a point — "Omotesando" in Tokyo.
//
// The city name is the geocoding context, which is exactly the case
// lib/geocode.ts describes context as being for: a district name is obscure
// and ambiguous on its own, and "Omotesando" alone could resolve anywhere.
//
// The answer is then *checked against the city it is supposed to be in*, and
// discarded when it is too far away. Without that check this feature would be
// a new way to produce the wrong-pin bug: a mistyped district would silently
// re-centre the search on another continent and return a confident list of
// cafes in the wrong country. Returning null instead lets the caller say "we
// could not find that area", which is true and useful.
export async function resolveAreaInCity(
  tripId: string,
  city: string,
  area: string,
  tripName?: string,
): Promise<Coordinates | null> {
  const cityCenter = await getCityCenter(tripId, city, tripName);
  if (!cityCenter) return null;

  // The city carries more signal than the trip name here, so it leads; the
  // trip name is appended because a city name alone can be ambiguous too.
  const context = tripName ? `${city} ${tripName}` : city;
  const point = await geocodePlace(area, context);
  if (!point) return null;

  if (!isSameDestination(cityCenter, point)) {
    console.warn(
      `[route] area "${area}" resolved outside ${city} and was rejected`,
    );
    return null;
  }
  return point;
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

// 🐞 The overview row is where a city's coordinates are cached — and it is
// only *created* by saveCityGuide, i.e. when the user opens that city's guide
// page. A city that entered the trip through the attractions search or the
// manual form has no overview row at all.
//
// This used to be a bare `update`, which Postgres reports as a success when it
// matches nothing. So for those cities the cache silently never filled: every
// render re-geocoded them (paced at ~1 request/second, on the shared Nominatim
// service), and phase F's country lookup and wrong-pin repair wrote their
// results into the void — which is why a corrected pin kept coming back wrong.
//
// Upserting creates the row when it is missing. `ignoreDuplicates: false` is
// the point: an existing row must be *updated*, not skipped, or the fix does
// nothing for exactly the cities that already have a guide.
async function cacheCoordinates(
  tripId: string,
  coords: Map<string, { latitude: number; longitude: number }>,
) {
  if (coords.size === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("suggested_destinations").upsert(
    [...coords].map(([city, { latitude, longitude }]) => ({
      trip_id: tripId,
      city,
      category: OVERVIEW_CATEGORY,
      // The overview row's name is the city's own — the convention
      // saveCityGuide established, and getEntryCoordinates relies on it by
      // skipping this category so an item sharing the city's name is not
      // placed at the centre of town.
      name: city,
      latitude,
      longitude,
      source: "ai" as const,
      selected: false,
    })),
    { onConflict: "trip_id,city,category,name", ignoreDuplicates: false },
  );

  if (error) {
    // Caching is best-effort: the map still renders from the fresh lookup.
    console.error("cacheCoordinates failed:", error.message);
  }
}

// Places a city the geocoder could not resolve, using a name the user supplies.
//
// This is the escape hatch for the case the geocoder is now honest about. Since
// the fix that made it verify its answers, a name it cannot confirm returns
// nothing rather than a confidently wrong pin — correct, but from the map it
// looks like the destination simply vanished. "קנזאווה" is the live example:
// neither Wikipedia nor OpenStreetMap has that Hebrew spelling indexed, while
// "Kanazawa" resolves immediately.
//
// So the repair asked of the user is "what is it called in English or in the
// local script", not "type in coordinates". That is a question a traveller can
// answer, and it fixes the actual cause — the spelling, not the arithmetic.
//
// The city's own name is unchanged; only its position is written. The trip
// keeps calling it what the user calls it.
export async function locateCityByName(
  tripId: string,
  city: string,
  alternateName: string,
  tripName?: string,
): Promise<Coordinates | null> {
  const point = await geocodePlace(alternateName, tripName);
  if (!point) return null;

  await cacheCoordinates(tripId, new Map([[city, point]]));

  // The country is derived from the new coordinates, not carried over: it is
  // what the country grouping and the misplaced-pin check both read, and a
  // stale one would be worse than none.
  await clearCityCountry(tripId, city);
  return point;
}

// Drops the cached country for one city, so the next render reverse-geocodes it
// from whatever position it now has.
async function clearCityCountry(tripId: string, city: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("suggested_destinations")
    .update({ country: null })
    .eq("trip_id", tripId)
    .eq("city", city)
    .eq("category", OVERVIEW_CATEGORY);

  if (error) console.error("clearCityCountry failed:", error.message);
}
