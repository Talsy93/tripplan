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
const USER_AGENT = "MyTrip/1.0 (https://github.com/Talsy93/tripplan)";
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

// Exported so a caller that has *better* context than the trip name can retry
// a single place with it — route-service re-runs a city that landed in the
// wrong country, passing the country the rest of the trip agreed on.
export async function geocodePlace(
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

  // Nominatim, on the bare name first and then with context.
  //
  // The bare query used to be forbidden, with a correct observation behind it:
  // "האקונה" on its own resolves to an office in Los Angeles, and a confidently
  // wrong pin is worse than none. What has changed is that the answer is now
  // *verified* — fetchNominatimCoordinates keeps only candidates whose
  // `addresstype` is somewhere a person could travel to, and that office comes
  // back as `addresstype=office` and is rejected.
  //
  // Allowing it matters, because Wikipedia cannot resolve every place: the
  // he.wikipedia article "טאקיאמה" exists but carries no coordinates, so the
  // Wikipedia path can only ever miss on it, while Nominatim answers
  // 36.1396,137.2510 — the right city — from the Hebrew name alone.
  //
  // Bare name before context: context narrows a search that is already precise,
  // and Nominatim resolved every city measured (Osaka, Kyoto, Nara, Hiroshima,
  // Takayama) without it while "קנזאווה יפן" found nothing that "קנזאווה" did
  // not.
  const bare = await fetchNominatimCoordinates(trimmed);
  if (bare) return bare;

  if (!cleaned) return null;
  await sleep(MIN_INTERVAL_MS);
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

    // The article's title must actually name the place asked for. If none does,
    // this is a miss.
    //
    // This used to end in `?? places[0]` — prefer a title match, otherwise take
    // the top-ranked article that happens to have coordinates. That is what put
    // pins in the wrong country, and the failure is worth spelling out because
    // it looks so reasonable:
    //
    //   `generator=search` is *full-text* search, not a place lookup. Searching
    //   he.wikipedia for "טאקיאמה" returns "פרס גראמי לאלבום השנה" (no
    //   coordinates), then "איסהאיה" — a different Japanese city 700km away —
    //   and the old code pinned Takayama onto Isahaya. Searching "טוקיו" ranks
    //   "פאלה דה טוקיו" second, which is a building in Paris; had Tokyo's own
    //   article been missing, Tokyo would have been pinned in France.
    //
    // A miss is the correct answer here. No pin is honest; a confidently wrong
    // pin is worse than none, and downstream country-correction can only repair
    // the cases where the wrong answer happened to land abroad.
    const wanted = normalizeName(name);
    const best = places.find((page) => {
      const title = normalizeName(page.title);
      // Prefix rather than equality: he.wikipedia titles a place with its
      // disambiguator attached — "שירקאווה-גו וגוקאיאמה" is the article for
      // "שירקאווה-גו", and rejecting it would lose a place we can resolve.
      return title === wanted || title.startsWith(wanted);
    });
    if (!best) return null;

    return { latitude: best.latitude, longitude: best.longitude };
  } catch {
    return null;
  }
}

// Compared with punctuation and Hebrew diacritics removed, because a title and a
// query rarely agree on them: "שירקאווה-גו" vs "שירקאווה גו", or a name written
// with gershayim. Whitespace goes too, so a hyphen/space difference cannot
// reject a real match.
function normalizeName(value: string): string {
  return value
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'׳״‘’“”()־-]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// Address types that can be a trip destination.
//
// This is what makes Nominatim safe to query on a bare Hebrew name, and it is
// the whole reason the bare query is allowed at all now. Measured against the
// real API:
//
//   "טאקיאמה"  → addresstype=city,     jp  ✅ the city
//   "האקונה"   → addresstype=office,   us  ❌ an immigrant-rights office in LA
//   "ניקו"     → addresstype=highway,      ❌ a road
//
// `province` and `state` are included because Japan's city-prefectures are
// mapped that way — "טוקיו" is addresstype=province in OSM, and excluding it
// would reject the single most common destination in the app's data.
const DESTINATION_ADDRESS_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "suburb",
  "borough",
  "district",
  "county",
  "province",
  "state",
]);

async function fetchNominatimCoordinates(
  name: string,
  context?: string,
): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    q: context ? `${name}, ${context}` : name,
    format: "jsonv2",
    // More than one, because the first hit is not always a settlement and the
    // filter below needs candidates to choose from.
    limit: "5",
    // Gives us `addresstype`, which is the discriminator.
    addressdetails: "1",
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

    const candidates = json as {
      lat?: string;
      lon?: string;
      addresstype?: string;
      display_name?: string;
    }[];

    // Highest-ranked candidate that is actually a place someone could travel
    // to. No fallback to candidates[0] — that is the same mistake the Wikipedia
    // path was making, and an office in Los Angeles is not a better answer than
    // no answer.
    const best = candidates.find(
      (candidate) =>
        candidate.addresstype !== undefined &&
        DESTINATION_ADDRESS_TYPES.has(candidate.addresstype),
    );

    if (!best) {
      console.warn(
        `[geocode] nominatim had results for "${name}" but none were a place: ` +
          candidates.map((c) => c.addresstype ?? "?").join(", "),
      );
      return null;
    }

    // Nominatim returns lat/lon as strings.
    const latitude = Number(best.lat);
    const longitude = Number(best.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Reverse: a point back to its country --------------------------------
//
// The opposite direction from everything above, and far more reliable than it.
// Forward-geocoding a Hebrew city name is guesswork — that is what put "האקונה"
// in Los Angeles — while a pair of coordinates sits in exactly one country and
// Nominatim answers that without ambiguity.
//
// Two uses, one lookup: grouping the trip's cities by country, and noticing a
// pin that landed in the wrong one.

const NOMINATIM_REVERSE_ENDPOINT =
  "https://nominatim.openstreetmap.org/reverse";

export type CountryInfo = {
  // The Hebrew name where Nominatim has one, for display.
  name: string;
  // ISO 3166-1 alpha-2, lowercase, for comparing two cities without worrying
  // about which language each name came back in.
  code: string;
};

export async function reverseCountry(
  point: Coordinates,
): Promise<CountryInfo | null> {
  const params = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
    format: "jsonv2",
    // Zoom 3 is the country level. Asking for less detail than we need keeps
    // the response small and lets Nominatim answer from a coarser index.
    zoom: "3",
    addressdetails: "1",
    "accept-language": "he,en",
  });

  try {
    const res = await fetch(`${NOMINATIM_REVERSE_ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      // A point does not move between countries. Cache for a week, like the
      // forward lookups above.
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      address?: { country?: string; country_code?: string };
    };
    const name = json.address?.country;
    const code = json.address?.country_code;
    if (!name || !code) return null;

    return { name, code: code.toLowerCase() };
  } catch {
    return null;
  }
}

// Reverse-geocodes several points, paced the same way geocodePlaces is —
// Nominatim's usage policy is one request a second and it is enforced.
export async function reverseCountries(
  points: Map<string, Coordinates>,
): Promise<Map<string, CountryInfo>> {
  const found = new Map<string, CountryInfo>();

  for (const [index, [key, point]] of [...points].entries()) {
    if (index > 0) await sleep(MIN_INTERVAL_MS);
    const country = await reverseCountry(point);
    if (country) found.set(key, country);
  }
  return found;
}
