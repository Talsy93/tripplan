import { after, NextResponse } from "next/server";
import * as z from "zod";
import { discoverRequestSchema, getCityCenter, getTrip } from "@/features/trips";
import { discoverAround, quickAround } from "@/lib/discover";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { DiscoverCard } from "@/features/trips";

// The "גילוי" deck. Open data only — see lib/discover.ts — so no key and no
// cost, but Overpass is a shared public server and a deck is up to four
// queries, so the limit is per user and tight.
// The first deal in a city is one Overpass query that can take fifteen
// seconds or more at busy hours, plus Wikidata and Wikipedia after it.
export const maxDuration = 60;

// A deck being filled in asks again every few seconds (see `partial`), so
// the ceiling allows a first deal and its follow-ups with room to spare.
const RATE_LIMIT = 24;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`discover:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = discoverRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }
  // `category` is still accepted and no longer used: the deck is every chip's
  // cards at once (see PER_CHIP in lib/discover.ts), and the chips filter it
  // in the browser — a press on one is instant instead of a second deal.
  const { tripId, cities } = parsed.data;

  // Reading the trip is also the permission check: RLS returns nothing for a
  // trip this user cannot see.
  const trip = await getTrip(tripId);
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // One city after another rather than together: Overpass counts concurrent
  // queries per client, and four at once is how a deck gets refused.
  const cards: DiscoverCard[] = [];
  let failed = 0;
  // True when some city's full deck is still being dealt. The deck then asks
  // again in a few seconds and appends what has arrived.
  let partial = false;
  const pending: Promise<unknown>[] = [];
  const started = Date.now();
  for (const city of cities) {
    // A country is several cities. Past a few seconds, answer with what is in
    // hand and let the rest arrive on the deck's next ask.
    if (cards.length > 0 && Date.now() - started > 8_000) {
      partial = true;
      break;
    }
    const center = await getCityCenter(tripId, city, trip.name);
    if (!center) {
      failed++;
      continue;
    }

    // The full deck, given eight seconds. From the cache it is instant; a
    // city's first deal is 10–20 seconds of Overpass, and nobody is made to
    // watch a spinner for that.
    const full = discoverAround({ city, center, category: "all" });
    const settled = await Promise.race([
      full,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    if (settled?.ok) {
      cards.push(...settled.cards);
      continue;
    }
    if (settled && !settled.ok) {
      failed++;
      continue;
    }

    // Not yet. It keeps dealing into the cache — `after` keeps the function
    // alive for it once this response has gone — and the quick deck (landmarks
    // near the centre) stands in meanwhile.
    partial = true;
    pending.push(full);
    cards.push(...(await quickAround({ city, center })));
  }
  if (pending.length > 0) after(() => Promise.allSettled(pending));

  if (cards.length === 0 && failed > 0 && !partial) {
    console.warn(`[discover] no deck for ${cities.join(", ")} — ${failed} failed`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // A country is several cities: one deck, the best-known first, and a place
  // on the border between two city radii only once.
  const seen = new Set<string>();
  const merged = cards
    .filter((card) => !seen.has(card.wikidata) && seen.add(card.wikidata))
    .sort((a, b) => {
      const photo = Number(Boolean(b.image)) - Number(Boolean(a.image));
      if (photo !== 0) return photo;
      return b.languages - a.languages;
    });

  return NextResponse.json({ cards: merged, partial });
}
