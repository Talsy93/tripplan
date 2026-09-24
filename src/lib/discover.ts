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
// Cached for a day: the Overpass answer and the finished decks in memory (see
// ELEMENTS and DECKS for why not in Next's fetch cache), Wikidata and
// Wikipedia in Next's fetch cache and per entity in memory. A city's sights
// do not change between two swipes, and Overpass asks to be spared.

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

// The finished deck per city and chip, for a day. Next's fetch cache does
// not cover the expensive step: an Overpass answer for a city centre is well
// over the 2MB it will store, so without this every chip press paid the full
// fifteen seconds again. In memory, so per server instance — which on a warm
// instance is exactly the swiping session it is for.
const DECKS = new Map<string, { at: number; cards: DiscoverCard[] }>();
const DECK_TTL_MS = 86_400_000;

export async function discoverAround(args: {
  city: string;
  center: { latitude: number; longitude: number };
  category: DiscoverCategory;
}): Promise<DiscoverOutcome> {
  const key = `${args.center.latitude.toFixed(3)},${args.center.longitude.toFixed(3)}|${args.category}`;
  const hit = DECKS.get(key);
  if (hit && Date.now() - hit.at < DECK_TTL_MS) {
    return { ok: true, cards: hit.cards.map((card) => ({ ...card, city: args.city })) };
  }
  const result = await deal(args);
  if (result.ok && result.cards.length > 0) {
    if (DECKS.size > 200) DECKS.delete(DECKS.keys().next().value!);
    DECKS.set(key, { at: Date.now(), cards: result.cards });
  }
  return result;
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

  // The main public server answers "too busy" (504) or "slow down" (429) often
  // at busy hours — measured while building this: the first try on Rome
  // failed three times in a row, and the next request a minute later came
  // back in thirteen seconds. So: the main server twice with a pause, then the
  // two public mirrors the Overpass wiki lists, each with its own timeout so a
  // hanging one cannot hold the deck.
  const attempts = [OVERPASS, OVERPASS, ...OVERPASS_MIRRORS];
  for (const [index, endpoint] of attempts.entries()) {
    try {
      const res = await fetch(`${endpoint}?${new URLSearchParams({ data })}`, {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok && res.headers.get("content-type")?.includes("json")) {
        const json = (await res.json()) as { elements?: Element[] };
        return json.elements ?? [];
      }
      if (index === 0) await new Promise((resolve) => setTimeout(resolve, 2_500));
    } catch {
      // Timed out or unreachable — the next endpoint.
    }
  }
  return null;
}

const OVERPASS_MIRRORS = [
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
