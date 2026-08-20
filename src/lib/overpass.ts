// Real-time place search via OpenStreetMap's Overpass API — free, no API key
// (project rule: paid services are off-limits).
//
// Overpass is a shared volunteer service with a strict usage policy: identify
// yourself, keep queries small and bounded, and expect to be turned away under
// load. Three things here are the direct result of measuring it:
//
//  - **No name matching in the query.** Overpass has no index for tag values,
//    so `["name"~"starbucks",i]` is a scan: measured at 57 seconds when it
//    worked at all, HTTP 504 when it didn't. Tag filters *are* indexed and
//    answer in about a second, so the query filters by tag and the name is
//    matched here, in process. That is also strictly better for the user —
//    it searches every name variant, not just the local-language one.
//  - **GET, not POST.** Next's fetch cache ignores POST, so a `revalidate` on
//    a POST does nothing and every search would hit the shared service.
//  - **A refusal is reported as a refusal, never as "no results".** Overpass
//    answers an overloaded request with 429/504 and a non-JSON body; treating
//    that as an empty result set is how a working search silently looks broken.

import {
  PLACE_CATEGORIES,
  comparePlaces,
  countDetails,
  isWorthShowing,
} from "@/features/trips/domain/place";
import type { Place, PlaceCategory } from "@/features/trips/domain/place";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "TripPlan/1.0 (https://github.com/Talsy93/tripplan)";
// Covers a city centre and the walkable ring around it. Deliberately not
// wider: a dense city has more matches than FETCH_LIMIT within a few
// kilometres, and Overpass has no way to ask for "the nearest N" — so a wider
// radius doesn't find more, it just makes the capped set less relevant. At 12km
// a Tokyo cafe search filled the cap with arbitrary results.
//
// This is purely about relevance. Radius does not predict whether Overpass
// answers: measured, the same query 504'd at 2km and succeeded at 5km minutes
// apart. See RETRY_DELAY_MS.
const RADIUS_M = 5_000;
// Overpass aborts server-side at this point rather than queueing forever.
const QUERY_TIMEOUT_S = 25;
// 429/504 from Overpass is momentary queue pressure, not a verdict on the
// query — measured, an identical query failed and then succeeded minutes
// apart. One retry converts most of those into a result; more than one would
// just add load to a service that is already saying it is busy.
const RETRY_DELAY_MS = 2_500;
// How many elements to ask Overpass for. Higher than what is shown, because
// the name filter is applied afterwards, in process.
//
// In a dense city this cap is reached, so results are a sample rather than
// every match — fine for suggesting places to a traveller, and the reason the
// radius stays tight.
const FETCH_LIMIT = 400;
// Higher than what the tab shows at once (PAGE_SIZE in place-search.tsx):
// "עוד תוצאות" reveals more of this same ranked list client-side rather than
// re-querying Overpass, since a repeat query of the same city/category just
// returns the same day-cached elements and the same top slice.
const MAX_RESULTS = 150;

export type OverpassOutcome =
  | { ok: true; places: Place[] }
  | { ok: false; reason: "unavailable" | "timeout" };

// Finds places near a point, optionally narrowed by category and by a name
// substring.
//
// `center` is the city's coordinates, which the route already resolved and
// cached — so searching costs one Overpass call and no geocoding.
export async function searchPlaces({
  center,
  category,
  query,
}: {
  center: { latitude: number; longitude: number };
  category?: PlaceCategory;
  query?: string;
}): Promise<OverpassOutcome> {
  const data = buildQuery({ center, category });

  const first = await runQuery(data, category, query, center);
  if (first.ok || first.reason !== "timeout") return first;

  // Busy, not broken — give the queue a moment and ask once more.
  await sleep(RETRY_DELAY_MS);
  return runQuery(data, category, query, center);
}

async function runQuery(
  data: string,
  category: PlaceCategory | undefined,
  query: string | undefined,
  center: { latitude: number; longitude: number },
): Promise<OverpassOutcome> {
  const params = new URLSearchParams({ data });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      // Only works because this is a GET — see the note at the top. A day of
      // caching keeps repeat browsing off the shared service entirely.
      next: { revalidate: 86_400 },
    });

    // 429 = too many requests, 504 = the server is saturated. Both mean "ask
    // again later", which is a different thing from "there is nothing here".
    if (res.status === 429 || res.status === 504) {
      return { ok: false, reason: "timeout" };
    }
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
      console.warn(`[overpass] refused the query (${res.status})`);
      return { ok: false, reason: "unavailable" };
    }

    const json = (await res.json()) as { elements?: OverpassElement[] };
    const needle = query?.trim().toLowerCase();

    const places = (json.elements ?? [])
      .map((element) => toPlace(element, category ?? null))
      .filter((place): place is Place => place !== null)
      .filter((place) => !needle || matchesName(place, needle))
      // OSM is full of name-only pins with nothing behind them. They are noise
      // in a list of suggestions, so they don't get shown.
      .filter(isWorthShowing);

    places.sort((a, b) => comparePlaces(a, b, center));
    return { ok: true, places: places.slice(0, MAX_RESULTS) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  // Ways have no coordinates of their own; `out center` asks Overpass to add
  // their centroid here.
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function buildQuery({
  center,
  category,
}: {
  center: { latitude: number; longitude: number };
  category?: PlaceCategory;
}) {
  const around = `around:${RADIUS_M},${center.latitude},${center.longitude}`;

  // With no category chosen, free text searches across every category at once.
  const filters = category
    ? PLACE_CATEGORIES[category].filters
    : Object.values(PLACE_CATEGORIES).flatMap((entry) => entry.filters);

  const clauses = filters
    .flatMap((filter) => {
      const [key, value] = filter.split("=");
      const tag = `["${key}"="${value}"]`;
      // Node and way cover essentially every POI. Relations are asked for
      // separately nowhere on purpose: they are rare for places and would add
      // half again to the query cost.
      return ["node", "way"].map((type) => `${type}${tag}(${around});`);
    })
    .join("\n  ");

  return [
    `[out:json][timeout:${QUERY_TIMEOUT_S}];`,
    "(",
    `  ${clauses}`,
    ");",
    // "center" adds a centroid to ways; the cap is a safety net.
    `out center ${FETCH_LIMIT};`,
  ].join("\n");
}

// Matches the search text against every name the place carries, so typing
// "starbucks" finds a Tokyo branch whose `name` tag is Japanese.
function matchesName(place: Place, needle: string) {
  return [place.name, place.localName].some(
    (candidate) => candidate?.toLowerCase().includes(needle) ?? false,
  );
}

function toPlace(
  element: OverpassElement,
  category: PlaceCategory | null,
): Place | null {
  const tags = element.tags ?? {};

  // OSM stores names in the local language: a Tokyo cafe comes back as
  // "スターバックス" with "Starbucks" only in name:en. Showing that raw would
  // make the whole feature unreadable, so prefer Hebrew, then English, and
  // fall back to the local name only when there's nothing else.
  const local = tags.name;
  const name = tags["name:he"] ?? tags["name:en"] ?? local;
  // A place with no name is no use in a list of suggestions.
  if (!name) return null;

  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const details = {
    cuisine: tags.cuisine ?? null,
    openingHours: tags.opening_hours ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    address: buildAddress(tags),
    brand: tags.brand ?? tags["brand:en"] ?? tags.operator ?? null,
  };

  return {
    id: `${element.type ?? "node"}/${element.id ?? 0}`,
    name,
    localName: local && local !== name ? local : null,
    latitude,
    longitude,
    category,
    ...details,
    // OSM has no reviews, so a Wikipedia/Wikidata link is the available stand-in
    // for "this is a place people know".
    notable: Boolean(tags.wikidata ?? tags.wikipedia ?? tags["brand:wikidata"]),
    detailCount: countDetails(details),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
