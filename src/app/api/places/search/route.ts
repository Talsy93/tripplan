import { NextResponse } from "next/server";
import * as z from "zod";
import {
  getCityCenter,
  getTrip,
  placeSearchRequestSchema,
  resolveAreaInCity,
} from "@/features/trips";
import { AREA_RADIUS_M, searchPlaces } from "@/lib/overpass";
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

  const { tripId, city, category, query, near, area } = parsed.data;

  // Reading the trip is also the authorisation check: RLS returns nothing for
  // a trip the caller doesn't own, so a stranger's tripId can't be searched.
  const trip = await getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Three ways to decide where to search, most specific first:
  //
  //   near  — an exact point the client already has (a result it is standing
  //           on). No lookup at all.
  //   area  — a district named by the user, resolved and verified to be
  //           inside the city.
  //   city  — the whole destination, which is what it has always been.
  let center: { latitude: number; longitude: number } | null = near ?? null;
  let radiusM: number | undefined;

  if (!center && area) {
    center = await resolveAreaInCity(tripId, city, area, trip.name);
    // Told apart from city_not_located on purpose: "we cannot find Tokyo" and
    // "we cannot find that district in Tokyo" call for different reactions,
    // and the second one is usually a typo the user can fix.
    if (!center) {
      return NextResponse.json({ error: "area_not_located" }, { status: 422 });
    }
    radiusM = AREA_RADIUS_M;
  }

  if (!center) {
    center = await getCityCenter(tripId, city, trip.name);
  }
  if (!center) {
    return NextResponse.json({ error: "city_not_located" }, { status: 422 });
  }

  // A point handed over by the client is a single place, so it gets the
  // district-sized ring too — "near this cafe" should not mean "in this half
  // of the city".
  if (near) radiusM = AREA_RADIUS_M;

  const result = await searchPlaces({ center, category, query, radiusM });
  if (!result.ok) {
    // 503 rather than 502: the service is fine, it's just busy — the client
    // tells the user to retry instead of reporting a failure.
    return NextResponse.json({ error: result.reason }, { status: 503 });
  }

  return NextResponse.json({ places: result.places });
}
