import { NextResponse } from "next/server";
import * as z from "zod";
import { discoverRequestSchema, getCityCenter, getTrip } from "@/features/trips";
import { discoverAround } from "@/lib/discover";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { DiscoverCard } from "@/features/trips";

// The "גילוי" deck. Open data only — see lib/discover.ts — so no key and no
// cost, but Overpass is a shared public server and a deck is up to four
// queries, so the limit is per user and tight.
// The first deal in a city is one Overpass query that can take fifteen
// seconds or more at busy hours, plus Wikidata and Wikipedia after it.
export const maxDuration = 60;

const RATE_LIMIT = 8;
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
  const { tripId, cities, category } = parsed.data;

  // Reading the trip is also the permission check: RLS returns nothing for a
  // trip this user cannot see.
  const trip = await getTrip(tripId);
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // One city after another rather than together: Overpass counts concurrent
  // queries per client, and four at once is how a deck gets refused.
  const cards: DiscoverCard[] = [];
  let failed = 0;
  for (const city of cities) {
    const center = await getCityCenter(tripId, city, trip.name);
    if (!center) {
      failed++;
      continue;
    }
    const result = await discoverAround({ city, center, category });
    if (!result.ok) {
      failed++;
      continue;
    }
    cards.push(...result.cards);
  }

  if (cards.length === 0 && failed > 0) {
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
      return category === "hidden"
        ? a.languages - b.languages
        : b.languages - a.languages;
    });

  return NextResponse.json({ cards: merged });
}
