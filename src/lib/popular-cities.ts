// Popular cities for a trip that has none yet, from its name alone.
//
// Asked for as: "when the trip is new there are no cities yet — suggest the
// popular cities to add, by the trip's name." A trip is called "איטליה — אביב
// 2027" or "יפן בסתיו" or "רומא ופירנצה" long before anything is in it, and the
// name is enough to know the country.
//
// Wikidata, because it is free, needs no key, and answers both halves in
// Hebrew: which word of the name is a country (or a city, and then its
// country), and that country's best-known cities. "Best-known" is the number
// of Wikipedias with an article on the city (sitelinks) — measured against the
// real endpoint it ranks the way a traveller would: Italy → רומא, ונציה,
// מילאנו, פירנצה, נאפולי; Japan → טוקיו, קיוטו, אוסקה; Spain → מדריד,
// ברצלונה, סביליה. Population would put Yokohama above Kyoto.
//
// No AI call. The endpoint is slow on a cold country (up to ~20s for Italy)
// and sometimes answers 502, so every failure is "no suggestions" and the
// caller streams this behind Suspense; a hit is cached for a week.

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "MyTrip/1.0 (https://github.com/Talsy93/tripplan)";
const WEEK = 604_800;

// What counts as a city: the generic classes plus the national ones countries
// actually use (an Italian city is a comune, a Japanese one "city of Japan").
// A fixed list rather than `wdt:P279*` over city, which timed out.
const CITY_TYPES = [
  "Q515", // city
  "Q1549591", // big city
  "Q5119", // capital
  "Q1637706", // city with millions of inhabitants
  "Q200250", // metropolis
  "Q494721", // city of Japan
  "Q1137833", // designated city (Japan)
  "Q2074737", // municipality of Spain
  "Q747074", // comune of Italy
  "Q484170", // commune of France
  "Q3957", // town
  "Q15284", // municipality
  "Q1093829", // city of the United States
  "Q42744322", // urban municipality (Germany)
]
  .map((id) => `wd:${id}`)
  .join(" ");

export type PopularCities = {
  country: string;
  cities: string[];
};

type Binding = Record<string, { value: string } | undefined>;

// One retry: the public endpoint answers the odd 502 or times out on a cold
// query, and measured, the same query a moment later succeeds ("יפן בסתיו"
// came back empty once and right twice).
async function sparql(query: string): Promise<Binding[] | null> {
  return (await sparqlOnce(query)) ?? sparqlOnce(query);
}

async function sparqlOnce(query: string): Promise<Binding[] | null> {
  try {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
      next: { revalidate: WEEK },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    const json = (await res.json()) as { results?: { bindings?: Binding[] } };
    return json.results?.bindings ?? null;
  } catch {
    return null;
  }
}

// The name's words, and the same words without a leading Hebrew particle —
// "ופירנצה" is "פירנצה", "בסתיו" is not a place either way. Pairs too, for
// two-word names ("ניו יורק", "ארצות הברית"). Anything with a digit (a year)
// goes.
function candidateNames(tripName: string): string[] {
  const words = tripName
    .split(/[\s,–—\-|/]+/)
    .map((word) => word.replace(/["'׳״()]/g, "").trim())
    .filter((word) => word.length > 1 && !/\d/.test(word));
  const out = new Set<string>();
  for (const word of words) {
    out.add(word);
    if (/^[ובלה]/.test(word) && word.length > 3) out.add(word.slice(1));
  }
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]} ${words[i + 1]}`);
  return [...out].slice(0, 20);
}

// A string is dropped into a SPARQL literal: quotes and backslashes out.
function literal(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"@he`;
}

export async function popularCitiesForTrip(tripName: string): Promise<PopularCities | null> {
  const names = candidateNames(tripName);
  if (names.length === 0) return null;

  // Which country the name points at: a word that *is* a country wins; else a
  // word that is a city, and its country. The best-known candidate first, so
  // "ברצלונה" is Spain's and not the town in Venezuela.
  const found = await sparql(`
    SELECT ?w ?country ?countryLabel ?direct ?links WHERE {
      VALUES ?w { ${names.map(literal).join(" ")} }
      ?place rdfs:label ?w ; wikibase:sitelinks ?links .
      { ?place wdt:P31 wd:Q6256 . BIND(?place AS ?country) BIND(1 AS ?direct) }
      UNION { ?place wdt:P31 wd:Q3624078 . BIND(?place AS ?country) BIND(1 AS ?direct) }
      UNION { VALUES ?type { ${CITY_TYPES} } ?place wdt:P31 ?type ; wdt:P17 ?country . BIND(0 AS ?direct) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
    } ORDER BY DESC(?direct) DESC(?links) LIMIT 20`);
  if (!found || found.length === 0) return null;

  const top = found[0];
  const countryUri = top.country?.value;
  const country = top.countryLabel?.value;
  if (!countryUri || !country) return null;
  const countryId = countryUri.split("/").pop();
  if (!countryId || !/^Q\d+$/.test(countryId)) return null;

  // Cities the name already mentions, in the order it mentions them — "רומא
  // ופירנצה" suggests those two first.
  const named = found
    .filter((row) => row.direct?.value === "0" && row.country?.value === countryUri)
    .map((row) => row.w?.value)
    .filter((value): value is string => Boolean(value));

  const rows = await sparql(`
    SELECT ?he (MAX(?links) AS ?l) WHERE {
      VALUES ?type { ${CITY_TYPES} }
      ?city wdt:P31 ?type ; wdt:P17 wd:${countryId} ; wdt:P1082 ?pop ; wikibase:sitelinks ?links .
      FILTER(?pop > 30000)
      ?city rdfs:label ?he . FILTER(LANG(?he) = "he")
    } GROUP BY ?he ORDER BY DESC(?l) LIMIT 10`);

  const cities = [
    ...new Set([...named, ...(rows ?? []).map((row) => row.he?.value ?? "")]),
  ].filter(Boolean);
  if (cities.length === 0) return null;

  return { country, cities: cities.slice(0, 10) };
}
