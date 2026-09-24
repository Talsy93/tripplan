// The deck behind "גילוי": what is worth seeing around a city, from open data
// only. Three free services, in order, and no key for any of them:
//
//   1. Overpass (OpenStreetMap) — the places around the city centre that match
//      the category's tags *and* carry a `wikidata` tag. The second condition
//      is the filter that makes a deck worth swiping: a place with a Wikidata
//      entry is one somebody wrote about, and it is what the next two steps
//      read from.
//   2. Wikidata — the Hebrew name, the photograph (P18, served by Wikimedia
//      Commons), and how many Wikipedias have an article on it.
//   3. Wikipedia — the first two sentences, Hebrew where there is a Hebrew
//      article and English otherwise.
//
// Three layers of cache, fastest first: finished decks in memory (DECKS), the
// same decks in Next's persistent data cache for a week (persistedDeck), and
// the raw answers — Overpass per city, Wikidata per entity — in memory. The
// discover page warms a trip's cities in the background (warmDiscover), so the
// slow first deal is paid by nobody who is waiting for it.

import { unstable_cache } from "next/cache";
import {
  kindOf,
  matchesCategory,
  type DiscoverCard,
  type DiscoverCategory,
} from "@/features/trips/domain/discover";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "MyTrip/1.0 (https://github.com/Talsy93/tripplan)";
const HEADERS = { "User-Agent": USER_AGENT };
const DAY = { next: { revalidate: 86_400 } };

// A city, not a region: 6km covers the centre of any city on the trip and
// keeps the query inside Overpass's patience.
const RADIUS_M = 6_000;
// Cards per city before merging. Enough for a long session of swiping, few
// enough that the Wikidata and Wikipedia calls stay at one or two each.
const PER_CITY = 40;

type Element = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type DiscoverOutcome =
  | { ok: true; cards: DiscoverCard[] }
  | { ok: false; reason: "unavailable" };

// The finished deck per city and chip, in memory for a day — the fastest of
// the three layers (this, persistedDeck, then the network). Per server
// instance, which on a warm instance is exactly the swiping session.
const DECKS = new Map<string, { at: number; cards: DiscoverCard[] }>();
const DECK_TTL_MS = 86_400_000;

export async function discoverAround(args: {
  city: string;
  center: { latitude: number; longitude: number };
  category: DiscoverCategory;
}): Promise<DiscoverOutcome> {
  const lat = Number(args.center.latitude.toFixed(3));
  const lon = Number(args.center.longitude.toFixed(3));
  const key = `${lat},${lon}|${args.category}`;
  const withCity = (cards: DiscoverCard[]) =>
    cards.map((card) => ({ ...card, city: args.city }));

  const hit = DECKS.get(key);
  if (hit && Date.now() - hit.at < DECK_TTL_MS) {
    return { ok: true, cards: withCity(hit.cards) };
  }

  // The page's warm-up and the deck's own request often ask for the same city
  // at the same moment; the second waits for the first instead of dealing it
  // all again.
  let dealing = DEALING.get(key);
  if (!dealing) {
    dealing = persistedDeck(lat, lon, args.category)
      .then((cards) => {
        if (DECKS.size > 200) DECKS.delete(DECKS.keys().next().value!);
        DECKS.set(key, { at: Date.now(), cards });
        return cards;
      })
      .finally(() => DEALING.delete(key));
    DEALING.set(key, dealing);
  }
  try {
    return { ok: true, cards: withCity(await dealing) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

const DEALING = new Map<string, Promise<DiscoverCard[]>>();

// The deck for a point and a chip, kept by Next's data cache — on disk in
// development, and the platform's shared data cache in production — for a
// week. This is what makes the wait a one-time cost per city rather than a
// per-visitor one: reported as "it loads for a very long time and then shows
// an error; a user cannot wait that long", and every open source measured for
// the first load (Overpass 7–50 s and 504s, Wikidata SPARQL 502, Wikipedia's
// geosearch capped at the nearest 500 — a kilometre in Rome) is either slow or
// unreliable on the first try. Paying it once, in the background (see
// warmDiscover), is the part that can be fixed.
//
// A failure throws, and unstable_cache does not store a throw — a busy
// Overpass must not be remembered as "Rome has no sights" for a week. An
// empty deck is stored: a chip with nothing in a city is a real answer.
const persistedDeck = unstable_cache(
  async (latitude: number, longitude: number, category: DiscoverCategory) => {
    const result = await deal({ city: "", center: { latitude, longitude }, category });
    if (!result.ok) throw new Error("discover: unavailable");
    return result.cards;
  },
  ["discover-deck-v1"],
  { revalidate: 7 * 86_400 },
);

// Deals every chip for each of these cities, one after another, so that by
// the time the traveller opens a city or presses a chip it is already there.
// Called from `after()` on the discover page: the response has gone, and
// nobody waits for this.
export async function warmDiscover(
  points: { city: string; latitude: number; longitude: number }[],
  categories: DiscoverCategory[],
) {
  for (const point of points) {
    for (const category of categories) {
      const result = await discoverAround({
        city: point.city,
        center: { latitude: point.latitude, longitude: point.longitude },
        category,
      });
      // Overpass refused this city — its other chips would all wait for the
      // same answer. Move on; the visitor's own request will try again.
      if (!result.ok) break;
    }
  }
}

async function deal({
  city,
  center,
  category,
}: {
  city: string;
  center: { latitude: number; longitude: number };
  category: DiscoverCategory;
}): Promise<DiscoverOutcome> {
  const elements = await cityElements(center);
  if (!elements) return { ok: false, reason: "unavailable" };
  const prefer = category === "all" ? undefined : category;

  // One card per Wikidata entity: a church is often a node, a way and a
  // relation at once.
  const byEntity = new Map<string, { element: Element; tags: Record<string, string> }>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const qid = tags.wikidata;
    if (!qid || !/^Q\d+$/.test(qid) || byEntity.has(qid)) continue;
    if (!matchesCategory(tags, category) || !kindOf(tags, prefer)) continue;
    byEntity.set(qid, { element, tags });
  }
  if (byEntity.size === 0) return { ok: true, cards: [] };

  // Two passes over Wikidata. A city centre has well over a thousand tagged
  // places, and asking for every one's claims — the photo lives there — is
  // dozens of heavy calls. So: sitelinks for all of them (light, in parallel),
  // which is both the ranking and the Hebrew and English titles; then labels
  // and claims for only the ones that will be dealt, with a margin for the
  // ones the second pass rules out (people, concepts).
  const hidden = category === "hidden";
  const ranked = await wikidata([...byEntity.keys()], "sitelinks");
  const shortlist = [...byEntity.keys()]
    .filter((qid) => ranked.has(qid) && (!hidden || (ranked.get(qid)?.languages ?? 0) >= 2))
    .sort((a, b) => {
      const diff = (ranked.get(b)?.languages ?? 0) - (ranked.get(a)?.languages ?? 0);
      return hidden ? -diff : diff;
    })
    .slice(0, PER_CITY + 20);
  const detailed = await wikidata(shortlist, "labels|claims");
  const entities = new Map(
    shortlist.flatMap((qid) => {
      const light = ranked.get(qid);
      const full = detailed.get(qid);
      return light && full ? [[qid, { ...full, ...pick(light) }] as const] : [];
    }),
  );

  const drafts = [...byEntity].flatMap(([qid, { element, tags }]) => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const kind = kindOf(tags, prefer);
    if (typeof latitude !== "number" || typeof longitude !== "number" || !kind) {
      return [];
    }
    const entity = entities.get(qid);
    if (!entity || entity.person || entity.concept) return [];
    const local = tags.name ?? null;
    const name =
      entity?.heLabel ??
      tags["name:he"] ??
      entity?.heTitle ??
      tags["name:en"] ??
      entity?.enLabel ??
      local;
    if (!name) return [];

    return [
      {
        qid,
        entity,
        card: {
          id: `${element.type ?? "node"}/${element.id ?? 0}`,
          wikidata: qid,
          city,
          name,
          localName: local && local !== name ? local : null,
          kindLabel: kind.label,
          category: kind.category,
          placeCategory: kind.placeCategory,
          latitude,
          longitude,
          image: entity?.image ?? null,
          summary: null,
          wikiUrl: null,
          languages: entity?.languages ?? 0,
          fee: tags.fee === "no" ? false : tags.fee === "yes" ? true : null,
          openingHours: tags.opening_hours ?? null,
          website: tags.website ?? tags["contact:website"] ?? null,
          visit: kind.visit,
        } satisfies DiscoverCard,
      },
    ];
  });

  // A card without a photograph is dealt last, never first. "פינות נסתרות"
  // turns the order over — the point of that chip is the places fewer people
  // have heard of.
  drafts.sort((a, b) => {
    const photo = Number(Boolean(b.card.image)) - Number(Boolean(a.card.image));
    if (photo !== 0) return photo;
    return hidden
      ? a.card.languages - b.card.languages
      : b.card.languages - a.card.languages;
  });
  const chosen = drafts.slice(0, PER_CITY);

  const summaries = await extracts(
    chosen.flatMap(({ entity }): { lang: "he" | "en"; title: string }[] =>
      entity?.heTitle
        ? [{ lang: "he" as const, title: entity.heTitle }]
        : entity?.enTitle
          ? [{ lang: "en" as const, title: entity.enTitle }]
          : [],
    ),
  );

  return {
    ok: true,
    cards: chosen.map(({ entity, card }) => {
      const source = entity?.heTitle
        ? { lang: "he", title: entity.heTitle }
        : entity?.enTitle
          ? { lang: "en", title: entity.enTitle }
          : null;
      const summary = source ? summaries.get(`${source.lang}:${source.title}`) : undefined;
      return {
        ...card,
        summary: summary ?? null,
        wikiUrl: source
          ? `https://${source.lang}.wikipedia.org/wiki/${encodeURIComponent(source.title.replaceAll(" ", "_"))}`
          : null,
      };
    }),
  };
}

// ---- Overpass -----------------------------------------------------------------

// Every place with a Wikidata tag around the city, once per city, whatever the
// chip. Measured on Rome while building this: the chips' own tag filters,
// as one query each, took 5–30 seconds and failed outright at busy hours; this
// single query — the `wikidata` key alone is well indexed — came back in about
// seven, with everything every chip needs. The chips then filter it here.
//
// Kept in memory for a day, beside DECKS, because the answer (~1.6MB for Rome)
// is close to what Next's fetch cache refuses to store.
const ELEMENTS = new Map<string, { at: number; elements: Element[] }>();
// Coalesces concurrent requests for the same city — a chip pressed while the
// first deal is still on the wire must not start a second Overpass query.
const PENDING = new Map<string, Promise<Element[] | null>>();

async function cityElements(center: {
  latitude: number;
  longitude: number;
}): Promise<Element[] | null> {
  const key = `${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}`;
  const hit = ELEMENTS.get(key);
  if (hit && Date.now() - hit.at < DECK_TTL_MS) return hit.elements;

  const pending = PENDING.get(key);
  if (pending) return pending;

  const request = overpass(center).then((elements) => {
    PENDING.delete(key);
    if (elements) {
      if (ELEMENTS.size > 50) ELEMENTS.delete(ELEMENTS.keys().next().value!);
      ELEMENTS.set(key, { at: Date.now(), elements });
    }
    return elements;
  });
  PENDING.set(key, request);
  return request;
}

async function overpass(center: {
  latitude: number;
  longitude: number;
}): Promise<Element[] | null> {
  const around = `around:${RADIUS_M},${center.latitude},${center.longitude}`;
  const data = `[out:json][timeout:25];\nnwr["wikidata"](${around});\nout tags center 6000;`;

  // overpass-api.de is two servers behind one name, `z` and `lz4`, and at a
  // busy hour one of them can be refusing every query ("Dispatcher_Client …
  // timeout", 504) while the other answers in eight seconds — measured on
  // 2026-09-24 while a real deck was failing: lz4 504 three times, z 200 each
  // time, and the shared name 504 because it handed the request to lz4. So the
  // two are asked by their own names, in turn, and the shared name and the
  // public mirrors come after. Each attempt has its own timeout so one hanging
  // server cannot hold the deck.
  // Forty seconds in all, whatever is left of it per attempt: the route has
  // sixty, and Wikidata and Wikipedia still come after this.
  const deadline = Date.now() + 40_000;
  for (const [index, endpoint] of OVERPASS_ENDPOINTS.entries()) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    try {
      const res = await fetch(`${endpoint}?${new URLSearchParams({ data })}`, {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(25_000, left)),
      });
      if (res.ok && res.headers.get("content-type")?.includes("json")) {
        const json = (await res.json()) as { elements?: Element[] };
        return json.elements ?? [];
      }
      console.warn(`[discover] ${endpoint} answered ${res.status}`);
      // A breath before going round to the first server again.
      if (index === 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
    } catch {
      console.warn(`[discover] ${endpoint} timed out or was unreachable`);
    }
  }
  return null;
}

const OVERPASS_ENDPOINTS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  OVERPASS,
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// ---- Wikidata -----------------------------------------------------------------

type Entity = {
  heLabel: string | null;
  enLabel: string | null;
  heTitle: string | null;
  enTitle: string | null;
  image: string | null;
  languages: number;
  // "instance of: human" (P31 = Q5). A statue or a memorial is often tagged
  // with the Wikidata id of the *person* it is of, and a card that reads the
  // poet's biography under a photo of his statue is the wrong card.
  person: boolean;
  // Has "subclass of" (P279): the entry is a kind of thing — "khachkar",
  // "drinking fountain" — that a mapper attached to one example of it.
  concept: boolean;
};

type RawEntity = {
  labels?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<
    string,
    { mainsnak?: { datavalue?: { value?: unknown } } }[]
  >;
};

// Wikipedia editions only: "enwiki", "hewiki", "zh_min_nanwiki" — not
// Commons, Wikispecies, Wikivoyage or the other projects that share the list.
const WIKIPEDIA_SITE = /^[a-z_]+wiki$/;
const NOT_WIKIPEDIA = new Set([
  "commonswiki",
  "specieswiki",
  "metawiki",
  "mediawikiwiki",
  "wikidatawiki",
  "sourceswiki",
  "outreachwiki",
]);

// The first pass's fields — what the ranking and the Wikipedia step need.
function pick(entity: Entity) {
  return {
    languages: entity.languages,
    heTitle: entity.heTitle,
    enTitle: entity.enTitle,
  };
}

// Fifty ids a call, six calls at a time: Wikidata asks for no more than a
// handful of parallel requests per client, and six batches of fifty cover the
// busiest city centre in one round.
// Per entity and per pass, for a day. The chips of one city share most of their
// places, and "all" is every chip at once — without this, each chip asked
// Wikidata again about the same thousand entities.
const ENTITIES = new Map<string, { at: number; entity: Entity }>();

async function wikidata(
  ids: string[],
  props: "sitelinks" | "labels|claims",
): Promise<Map<string, Entity>> {
  const found = new Map<string, Entity>();
  const missing: string[] = [];
  for (const qid of ids) {
    const hit = ENTITIES.get(`${props}:${qid}`);
    if (hit && Date.now() - hit.at < DECK_TTL_MS) found.set(qid, hit.entity);
    else missing.push(qid);
  }
  const batches: string[][] = [];
  for (let start = 0; start < missing.length; start += 50) {
    batches.push(missing.slice(start, start + 50));
  }

  async function one(batch: string[]) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props,
      format: "json",
    });
    if (props !== "sitelinks") params.set("languages", "he|en");
    try {
      const res = await fetch(`${WIKIDATA}?${params}`, { headers: HEADERS, ...DAY });
      if (!res.ok) return;
      const json = (await res.json()) as { entities?: Record<string, RawEntity> };
      for (const [qid, raw] of Object.entries(json.entities ?? {})) {
        const sites = raw.sitelinks ?? {};
        const file = raw.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        const instances = (raw.claims?.P31 ?? []).map(
          (claim) =>
            (claim.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id,
        );
        const entity: Entity = {
          heLabel: raw.labels?.he?.value ?? null,
          enLabel: raw.labels?.en?.value ?? null,
          heTitle: sites.hewiki?.title ?? null,
          enTitle: sites.enwiki?.title ?? null,
          image:
            typeof file === "string"
              ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800`
              : null,
          person: instances.includes("Q5"),
          concept: (raw.claims?.P279 ?? []).length > 0,
          languages: Object.keys(sites).filter(
            (site) => WIKIPEDIA_SITE.test(site) && !NOT_WIKIPEDIA.has(site),
          ).length,
        };
        found.set(qid, entity);
        if (ENTITIES.size > 20_000) ENTITIES.clear();
        ENTITIES.set(`${props}:${qid}`, { at: Date.now(), entity });
      }
    } catch {
      // One failed batch costs those places their card, not the deck.
    }
  }

  for (let start = 0; start < batches.length; start += 6) {
    await Promise.all(batches.slice(start, start + 6).map(one));
  }
  return found;
}

// ---- Wikipedia ----------------------------------------------------------------

// The first two sentences of each article, keyed "he:title". The extracts API
// answers at most twenty intro extracts per request.
async function extracts(
  pages: { lang: "he" | "en"; title: string }[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const lang of ["he", "en"] as const) {
    const titles = pages.filter((page) => page.lang === lang).map((page) => page.title);
    for (let start = 0; start < titles.length; start += 20) {
      const params = new URLSearchParams({
        action: "query",
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        exsentences: "2",
        exlimit: "20",
        titles: titles.slice(start, start + 20).join("|"),
        format: "json",
      });
      try {
        const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
          headers: HEADERS,
          ...DAY,
        });
        if (!res.ok) continue;
        const json = (await res.json()) as {
          query?: {
            normalized?: { from: string; to: string }[];
            pages?: Record<string, { title?: string; extract?: string }>;
          };
        };
        const back = new Map(
          (json.query?.normalized ?? []).map((entry) => [entry.to, entry.from]),
        );
        for (const page of Object.values(json.query?.pages ?? {})) {
          const text = page.extract?.trim();
          if (!page.title || !text) continue;
          const asked = back.get(page.title) ?? page.title;
          found.set(`${lang}:${asked}`, text.slice(0, 1200));
        }
      } catch {
        // A card without a summary still has its name, photo and facts.
      }
    }
  }
  return found;
}
