// Free geocoding — no API key, no billing (project rule: paid services are
// off-limits). Turns a place name into coordinates so the route map can pin it.
//
// Cities reach us with Hebrew names from the AI, which shapes the whole
// strategy. Lookups are tried in this order, first hit wins:
//
//  1. Wikipedia (Hebrew, then English) on the name alone. This is the precise
//     query: "אוסאקה" returns the article for Osaka even though it is spelled
//     "אוסקה" there. Requiring the article to carry coordinates filters out
//     results that aren't places.
//  2. The same search with `context` appended, for names too obscure or too
//     ambiguous to stand alone — "האקונה" by itself returns Hakuna Matata.
//  3. Nominatim (OpenStreetMap), for places Wikipedia has no article for.
//
// Context comes last on purpose: it *lowers* accuracy for well-known cities,
// because Wikipedia ranks the phrase as a whole and a nearby article can match
// it better than the city itself.
//
// Both APIs throttle bursts, and Wikimedia answers a throttled request with
// plain text rather than JSON — which reads as "no such place" unless checked
// for. So callers must go through geocodePlaces(), which serialises lookups
// and paces them. Results are cached in the database by the caller, so a city
// is normally geocoded only once.

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
// Wikimedia and Nominatim both require a User-Agent that identifies the client
// and offers a way to reach its author. A bare product name gets throttled.
const USER_AGENT = "TripPlan/1.0 (https://github.com/Talsy93/tripplan)";
const MIN_INTERVAL_MS = 1_100;
// Wikimedia has no published per-second figure, but it throttles bursts hard.
// Resolving one city can take up to four searches (name/context × he/en), so
// space them out.
const WIKI_INTERVAL_MS = 400;
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
    } else {
      console.warn(
        `[geocode] no coordinates for "${name}" (context: ${context ?? "none"})`,
      );
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

  // The name on its own is the most precise query there is: "אוסקה" returns
  // the city, exactly. Context is only useful for names that are ambiguous or
  // obscure on their own, and it actively hurts the rest — Wikipedia's search
  // ranks the whole phrase, so a well-known city can lose to an article that
  // matches the context better. So: name alone first, context only as a
  // rescue.
  const cleaned = cleanContext(context);
  const attempts: (string | undefined)[] = cleaned
    ? [undefined, cleaned]
    : [undefined];

  for (const attempt of attempts) {
    for (const lang of WIKI_LANGS) {
      const coords = await fetchWikiCoordinates(lang, trimmed, attempt);
      if (coords) return coords;
      // Wikimedia throttles bursts, and a throttled response reads as "no
      // result" — pace the retries so a miss is a real miss.
      await sleep(WIKI_INTERVAL_MS);
    }
  }

  // Only fall back to Nominatim when we have context to constrain it. Bare
  // Hebrew names match wildly unrelated places — "האקונה" alone resolves to an
  // office in Los Angeles — and a confidently wrong pin is worse than none.
  if (!cleaned) return null;
  return fetchNominatimCoordinates(trimmed, cleaned);
}

// Trip names carry noise that wrecks a full-text search: "יפן 2026" makes
// Wikipedia return the article for the year 2026, the 2026 Winter Olympics and
// the 2026 World Cup — none of them places. Keep only the words.
function cleanContext(context?: string): string | undefined {
  if (!context) return undefined;
  const words = context
    .split(/\s+/)
    .filter((word) => word.length > 1 && !/\d/.test(word));
  return words.length > 0 ? words.join(" ") : undefined;
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

    // A throttled request comes back as plain text ("You are making too many
    // requests to the API"), which would otherwise blow up in res.json() and
    // be swallowed as "no such place". Say so instead — the city is fine, we
    // were just asking too fast.
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
      console.warn(
        `[geocode] ${lang}.wikipedia refused "${name}" (${res.status})`,
      );
      return null;
    }

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
