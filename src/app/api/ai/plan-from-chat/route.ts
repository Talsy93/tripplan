import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiTripPlanSchema,
  getSelectedDestinations,
  getTrip,
  listChatMessages,
  planFromChatRequestSchema,
  recentHistory,
} from "@/features/trips";
import { generateStructured } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { SelectedItem, TripChatMessage } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// Reads the conversation and turns it into destinations.
//
// This route only proposes: nothing is written here. The plan goes back to the
// client for the user to look at, and a separate action saves it. An AI that
// rewrites your trip because you asked it a question is the thing this design
// is avoiding.
function buildPrompt(
  tripName: string,
  transcript: TripChatMessage[],
  alreadySelected: SelectedItem[],
) {
  const conversation = transcript
    .map(
      (entry) =>
        `${entry.role === "user" ? "מטייל" : "מתכנן"}: ${entry.content}`,
    )
    .join("\n");

  return [
    "אתה מתכנן טיולים מקצועי.",
    `להלן שיחה על הטיול "${tripName}". קרא אותה והפק ממנה מסלול מוצע.`,
    "",
    "--- השיחה ---",
    conversation,
    "--- סוף השיחה ---",
    "",
    alreadySelected.length > 0
      ? `כבר נבחרו לטיול: ${alreadySelected.map((item) => `${item.name} (${item.city})`).join(", ")}. אל תציע אותם שוב.`
      : "",
    "",
    "החזר:",
    "- summary: משפט או שניים על מה שהבנת שהמטייל מחפש.",
    "- cities: הערים שסוכמו בשיחה. לכל עיר: name, intro (משפט על העיר), ו-items.",
    "- לכל item: name, description, ו-category מתוך: areas (אזור לינה), restaurants, attractions, experiences.",
    "",
    "הסתמך רק על מה שעלה בשיחה. אם השיחה לא הגיעה לערים מסוימות — החזר cities ריק.",
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

  const parsed = planFromChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const { tripId } = parsed.data;

  const limit = checkRateLimit(
    `ai:plan:${user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  // Reading the trip is also the authorisation check — RLS returns nothing for
  // a trip the caller doesn't own.
  const [trip, transcript, selected] = await Promise.all([
    getTrip(tripId),
    listChatMessages(tripId),
    getSelectedDestinations(tripId),
  ]);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (transcript.length === 0) {
    return NextResponse.json({ error: "no_conversation" }, { status: 400 });
  }

  try {
    const plan = await generateStructured({
      prompt: buildPrompt(trip.name, recentHistory(transcript), selected),
      schema: aiTripPlanSchema,
    });
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
