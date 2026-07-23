import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiItineraryRequestSchema,
  aiItinerarySchema,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  saveItinerary,
  setTripStatus,
} from "@/features/trips";
import { generateStructured } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { SelectedItem } from "@/features/trips";
import type { Trip } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const CATEGORY_LABELS: Record<string, string> = {
  areas: "אזור לינה",
  restaurants: "מסעדה",
  attractions: "אטרקציה",
  experiences: "חוויה",
};

function buildPrompt(trip: Trip, items: SelectedItem[]) {
  const list = items
    .map(
      (item) =>
        `- ${item.name} (${item.city}, ${CATEGORY_LABELS[item.category] ?? item.category})`,
    )
    .join("\n");

  return [
    "אתה מתכנן טיולים מקצועי.",
    `בנה לו"ז יומי לטיול "${trip.name}".`,
    trip.start_date && trip.end_date
      ? `תאריכי הטיול: ${trip.start_date} עד ${trip.end_date}.`
      : "אין תאריכים קבועים — קבע מספר ימים סביר לפי כמות הפריטים.",
    "הפריטים שנבחרו לטיול:",
    list,
    "סדר אותם לימים ולפי שעות (מהבוקר לערב), בהתחשב בקרבה גאוגרפית ובזרימה טבעית של יום טיול.",
    'לכל פריט: name (מתוך הרשימה), start_time ו-end_time בפורמט "HH:MM", ו-note קצר.',
    "השב בעברית.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = aiItineraryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const { tripId } = parsed.data;

  const limit = checkRateLimit(`ai:itinerary:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  const [trip, items] = await Promise.all([
    getTrip(tripId),
    getSelectedDestinations(tripId),
  ]);

  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "no_selection" }, { status: 400 });
  }

  try {
    const itinerary = await generateStructured({
      prompt: buildPrompt(trip, items),
      schema: aiItinerarySchema,
    });
    await saveItinerary(tripId, itinerary);
    await setTripStatus(tripId, "executing");
    // Return the persisted itinerary so the client has row ids (for deletion).
    const saved = await getItinerary(tripId);
    return NextResponse.json({ days: saved });
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
