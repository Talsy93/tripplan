import { NextResponse } from "next/server";
import * as z from "zod";
import {
  appendChatMessages,
  getSelectedDestinations,
  getTrip,
  listChatMessages,
  recentHistory,
  sendChatRequestSchema,
} from "@/features/trips";
import { generateText } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { SelectedItem, Trip } from "@/features/trips";

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

// The model is told what the trip already contains, so the conversation starts
// informed instead of asking the user to restate what they've already chosen.
//
// It's told not to invent an itinerary in prose, because there's a button for
// that: turning the conversation into actual destinations is a separate,
// deliberate step (stage 17b) rather than something that happens mid-sentence.
function buildSystemInstruction(trip: Trip, selected: SelectedItem[]) {
  const cities = [...new Set(selected.map((item) => item.city))].filter(
    Boolean,
  );

  return [
    "אתה מתכנן טיולים מקצועי שמשוחח עם מטייל ישראלי.",
    `הטיול נקרא "${trip.name}".`,
    trip.start_date && trip.end_date
      ? `תאריכים: ${trip.start_date} עד ${trip.end_date}.`
      : "עדיין אין תאריכים לטיול.",
    cities.length > 0
      ? `יעדים שכבר נבחרו: ${cities.join(", ")}.`
      : "עדיין לא נבחרו יעדים.",
    selected.length > 0
      ? `פריטים שכבר נבחרו: ${selected.map((item) => item.name).join(", ")}.`
      : "",
    "",
    "תפקידך לחדד את מה שהמטייל מחפש: שאל שאלות ממוקדות, הצע רעיונות, ותעזור לגבש מסלול.",
    "כתוב בעברית, בקצרה ובאופן שיחתי. אל תשתמש בטבלאות.",
    "אל תמציא מסלול יומי מלא בטקסט — כשהמטייל ירצה, יש כפתור שבונה אותו מהשיחה.",
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

  const parsed = sendChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const { tripId, message } = parsed.data;

  const limit = checkRateLimit(
    `ai:chat:${user.id}`,
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
  const [trip, selected, history] = await Promise.all([
    getTrip(tripId),
    getSelectedDestinations(tripId),
    listChatMessages(tripId),
  ]);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const reply = await generateText({
      systemInstruction: buildSystemInstruction(trip, selected),
      messages: [
        ...recentHistory(history).map((entry) => ({
          role: entry.role,
          text: entry.content,
        })),
        { role: "user" as const, text: message },
      ],
    });

    // Both turns together: a reply saved without its question would leave a
    // conversation that reads as if the model spoke unprompted.
    await appendChatMessages(tripId, [
      { role: "user", content: message },
      { role: "model", content: reply },
    ]);

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
