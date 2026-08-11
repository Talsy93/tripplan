import { NextResponse } from "next/server";
import * as z from "zod";
import {
  getCityCenter,
  getTrip,
  placeSearchRequestSchema,
} from "@/features/trips";
import { searchPlaces } from "@/lib/overpass";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Overpass is a shared volunteer service, so this sits lower than the AI
// routes: browsing categories should not turn into a burst of queries.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(
    `places:search:${user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
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

  const parsed = placeSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const { tripId, city, category, query } = parsed.data;

  // Reading the trip is also the authorisation check: RLS returns nothing for
  // a trip the caller doesn't own, so a stranger's tripId can't be searched.
  const trip = await getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const center = await getCityCenter(tripId, city, trip.name);
  if (!center) {
    return NextResponse.json({ error: "city_not_located" }, { status: 422 });
  }

  const result = await searchPlaces({ center, category, query });
  if (!result.ok) {
    // 503 rather than 502: the service is fine, it's just busy — the client
    // tells the user to retry instead of reporting a failure.
    return NextResponse.json({ error: result.reason }, { status: 503 });
  }

  return NextResponse.json({ places: result.places });
}
