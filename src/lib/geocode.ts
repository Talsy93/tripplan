// Free geocoding — no API key, no billing (project rule: paid services are
// off-limits). Turns a place name into coordinates so the route map can pin it.
//
// Two providers, in order:
//
//  1. Wikipedia (Hebrew, then English). Cities reach us with Hebrew names from
//     the AI, and Nominatim resolves those poorly — "האקונה" with no country
//     context matched a place in the US. Wikipedia's search handles Hebrew
//     names natively, and requiring the article to carry coordinates filters
//     out results that aren't places at all.
//  2. Nominatim (OpenStreetMap), with the trip name appended as context, for
//     places Wikipedia has no article for.
//
// Nominatim's usage policy requires an identifying User-Agent and allows at
// most one request per second, so callers must go through geocodePlaces(),
// which serialises lookups and paces them. Results are cached in the database
// by the caller, so a city is normally geocoded only once.

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TripPlan/1.0 (portfolio project)";
const MIN_INTERVAL_MS = 1_100;
const WIKI_LANGS = ["he", "en"] as const;

export type Coordinates = { latitude: number; longitude: number };

// Geocodes several places one at a time, pacing requests to stay within
// Nominatim's policy. `context` disambiguates the place names — pass the trip
// name (e.g. "יפן 2026"), which is usually enough to pin down the country.
// Places that can't be resolved are simply absent from the returned map, so
// callers can render the rest.
export async function geocodePlaces(
  names: string[],
  context?: string,
): Promise<Map<string, Coordinates>> {
  const found = new Map<string, Coordinates>();

  for (const [index, name] of names.entries()) {
    if (index > 0) {
      await sleep(MIN_INTERVAL_MS);
    }
    const coords = await geocodePlace(name, context);
    if (coords) {
      found.set(name, coords);
    }
  }
  return found;
}

async function geocodePlace(
  name: string,
  context?: string,
): Promise<Coordinates | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  for (const lang of WIKI_LANGS) {
    const coords = await fetchWikiCoordinates(lang, trimmed, context);
    if (coords) return coords;
  }

  // Only fall back to Nominatim when we have context to constrain it. Bare
  // Hebrew names match wildly unrelated places — "האקונה" alone resolves to an
  // office in Los Angeles — and a confidently wrong pin is worse than none.
  if (!context) return null;
  return fetchNominatimCoordinates(trimmed, context);
}

async function fetchWikiCoordinates(
  lang: string,
  name: string,
  context?: string,
): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "coordinates",
    generator: "search",
    gsrsearch: context ? `${name} ${context}` : name,
    // A few candidates, so a non-place top hit doesn't lose us the real one.
    gsrlimit: "3",
    gsrnamespace: "0",
  });
  const endpoint = `https://${lang}.wikipedia.org/w/api.php?${params}`;

  try {
    const res = await fetch(endpoint, {
      // Wikimedia asks API clients to identify themselves.
      headers: { "User-Agent": USER_AGENT },
      // A place's coordinates never change — cache for a week.
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title?: string;
            coordinates?: { lat?: number; lon?: number }[];
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages ?? {});
    if (pages.length === 0) return null;

    // The API returns pages keyed by id, not in search-rank order; `index`
    // carries the rank. Keep only pages that are actually places — an article
    // without coordinates can't be one, which filters out the likes of
    // "האקונה מטטה" for a search on "האקונה".
    const places: (Coordinates & { title: string })[] = [];
    for (const page of pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
      const point = page.coordinates?.[0];
      if (typeof point?.lat === "number" && typeof point?.lon === "number") {
        places.push({
          title: page.title ?? "",
          latitude: point.lat,
          longitude: point.lon,
        });
      }
    }
    if (places.length === 0) return null;

    // Search ranks by relevance to "<name> <context>", so a nearby place can
    // outrank the one asked for. Prefer a title that actually names it.
    const best = places.find((page) => page.title.includes(name)) ?? places[0];
    return { latitude: best.latitude, longitude: best.longitude };
  } catch {
    return null;
  }
}

async function fetchNominatimCoordinates(
  name: string,
  context?: string,
): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    q: context ? `${name}, ${context}` : name,
    format: "jsonv2",
    limit: "1",
    // Lets Nominatim match Hebrew place names where OSM has them.
    "accept-language": "he,en",
  });

  try {
    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    // Nominatim returns lat/lon as strings.
    const { lat, lon } = json[0] as { lat?: string; lon?: string };
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
