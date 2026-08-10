// Free place photos from Wikipedia — no API key, no billing (project rule:
// paid services are off-limits). Tries Hebrew Wikipedia first, then English,
// and returns null when nothing is found so callers fall back to a gradient.
//
// Images come back on upload.wikimedia.org; that host is allow-listed for
// next/image in next.config.ts.

const WIKI_LANGS = ["he", "en"] as const;

export async function getPlaceImage(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const lang of WIKI_LANGS) {
    const url = await fetchWikiThumb(lang, trimmed);
    if (url) return url;
  }
  return null;
}

async function fetchWikiThumb(
  lang: string,
  query: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1000",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    gsrnamespace: "0",
  });
  const endpoint = `https://${lang}.wikipedia.org/w/api.php?${params}`;

  try {
    const res = await fetch(endpoint, {
      // Wikimedia asks API clients to identify themselves.
      headers: { "User-Agent": "TripPlan/1.0 (portfolio project)" },
      // A place's lead photo rarely changes — cache for a day.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const pages = json.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (typeof src === "string") return src;
    }
    return null;
  } catch {
    return null;
  }
}
