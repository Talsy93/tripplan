// Free place photos from Wikipedia — no API key, no billing (project rule:
// paid services are off-limits). Tries Hebrew Wikipedia first, then English,
// and returns null when nothing is found so callers fall back to a gradient.
//
// Images come back on upload.wikimedia.org; that host is allow-listed for
// next/image in next.config.ts.

const WIKI_LANGS = ["he", "en"] as const;

// `near` is the city: it narrows the search, but only the place's own name
// decides which result is the place — a page about the city itself, or about
// anything else in it, shares the city's name with every stop there.
export async function getPlaceImage(
  query: string,
  near?: string | null,
): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const lang of WIKI_LANGS) {
    const url = await fetchWikiThumb(lang, trimmed, near?.trim() || null);
    if (url) return url;
  }
  return null;
}

async function fetchWikiThumb(
  lang: string,
  query: string,
  near: string | null,
): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "800",
    generator: "search",
    gsrsearch: near ? `${query} ${near}` : query,
    // Five, and the best-titled one wins — see pickPage. The first hit alone
    // was often a neighbour: "מגדל טוקיו סקייטרי" found some other tower.
    gsrlimit: "5",
    gsrnamespace: "0",
  });
  const endpoint = `https://${lang}.wikipedia.org/w/api.php?${params}`;

  try {
    const res = await fetch(endpoint, {
      // Wikimedia asks API clients to identify themselves, and prefers a way
      // to reach the author — so this carries the repo URL, matching the
      // agent string lib/geocode.ts and lib/overpass.ts already send. It said
      // "portfolio project" until the rename, which identified nobody.
      headers: {
        "User-Agent": "MyTrip/1.0 (https://github.com/Talsy93/tripplan)",
      },
      // A place's lead photo rarely changes — cache for a day.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; index?: number; thumbnail?: { source?: string } }
        >;
      };
    };
    const pages = json.query?.pages;
    if (!pages) return null;

    return pickPage(query, near, Object.values(pages));
  } catch {
    return null;
  }
}

const WORD_BREAK = /[\s,.'"׳״()\-–]+/;

// The search result whose title shares the most words with the place's name,
// with the search's own order breaking ties. A page that shares none is not
// this place, and no photo beats a photo of somewhere else.
function pickPage(
  query: string,
  near: string | null,
  pages: { title?: string; index?: number; thumbnail?: { source?: string } }[],
): string | null {
  const words = new Set(
    query
      .toLowerCase()
      .split(WORD_BREAK)
      .filter((word) => word.length > 1),
  );
  // The city's words say nothing about which stop this is.
  for (const word of (near ?? "").toLowerCase().split(WORD_BREAK)) {
    if (words.size > 1) words.delete(word);
  }

  let best: { src: string; score: number; index: number } | null = null;
  for (const page of pages) {
    const src = page.thumbnail?.source;
    if (typeof src !== "string" || !page.title) continue;
    const titleWords = page.title
      .toLowerCase()
      .split(WORD_BREAK)
      .filter((word) => word.length > 1);
    const score = titleWords.filter((word) => words.has(word)).length;
    const index = page.index ?? 99;
    if (
      score > 0 &&
      (!best || score > best.score || (score === best.score && index < best.index))
    ) {
      best = { src, score, index };
    }
  }
  return best?.src ?? null;
}
