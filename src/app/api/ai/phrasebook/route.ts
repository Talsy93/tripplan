import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiPhrasebookSchema,
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  phrasebookRequestSchema,
  PHRASE_TOPICS,
  savePhrasebook,
} from "@/features/trips";
import {
  AiQuotaExceededError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// The destination language is inferred from the trip rather than asked for:
// the app stores cities, not countries, and making someone pick "Japanese"
// after they've already listed Tokyo and Osaka is asking them to repeat
// themselves.
function buildPrompt(tripName: string, places: string[]) {
  return [
    "אתה מדריך שפה למטיילים ישראלים.",
    `הטיול נקרא "${tripName}".`,
    places.length > 0
      ? `היעדים בטיול: ${places.join(", ")}.`
      : "אין עדיין יעדים מוגדרים — הסק את היעד משם הטיול.",
    "",
    "קבע לפי היעדים מהי שפת המקום, והחזר אותה גם בעברית (language) וגם באנגלית (language_english).",
    "בנה שיחון בסיסי למטייל, מחולק לנושאים הבאים בדיוק ובסדר הזה:",
    ...PHRASE_TOPICS.map((topic) => `- ${topic}`),
    "",
    "לכל נושא 5–7 ביטויים שימושיים באמת.",
    "לכל ביטוי:",
    "- he: הביטוי בעברית",
    "- en: הביטוי באנגלית",
    "- local: הביטוי בשפת היעד, בכתב המקורי שלה",
    "- pronunciation: איך הוגים אותו, כתוב באותיות עבריות",
    "",
    "השדה pronunciation הוא הכי חשוב: הקורא לא יודע לקרוא את כתב היעד.",
    "אם שפת היעד כבר נכתבת באותיות לטיניות, כתוב בכל זאת תעתיק עברי קריא.",
  ].join("\n");
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

  const parsed = phrasebookRequestSchema.safeParse(body);
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
    `ai:phrasebook:${user.id}`,
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
  const [trip, selected, savedCities] = await Promise.all([
    getTrip(tripId),
    getSelectedDestinations(tripId),
    getSavedCities(tripId),
  ]);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cities the user committed to first; anything merely suggested is a weaker
  // signal but still better than guessing from the trip's name alone.
  const places = [
    ...new Set([
      ...selected.map((item) => item.city),
      ...savedCities.map((city) => city.name),
    ]),
  ].filter(Boolean);

  try {
    const phrasebook = await generateStructured({
      prompt: buildPrompt(trip.name, places),
      schema: aiPhrasebookSchema,
    });
    await savePhrasebook(tripId, phrasebook);
    return NextResponse.json(phrasebook);
  } catch (error) {
    if (error instanceof AiQuotaExceededError) {
      return NextResponse.json({ error: "ai_quota_exceeded" }, { status: 503 });
    }
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_busy" }, { status: 503 });
    }
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
