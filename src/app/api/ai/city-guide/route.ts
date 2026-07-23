import { NextResponse } from "next/server";
import * as z from "zod";
import { aiCityGuideRequestSchema, aiCityGuideSchema } from "@/features/trips";
import { generateStructured } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AiCityGuideRequest } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function buildPrompt({ city, context }: AiCityGuideRequest) {
  return [
    "אתה מדריך טיולים מקצועי.",
    `הכן מדריך לעיר ${city}.`,
    context ? `הקשר הטיול: "${context}".` : "",
    "החזר:",
    "- intro: 2-3 משפטי רקע על העיר — אופי, אווירה, ולמה כדאי לבקר.",
    "- getting_there: היכן העיר ממוקמת, מרחק/זמן מהעיר המרכזית הקרובה, ואיך הכי כדאי להגיע ומאיפה.",
    "- areas: 4 אזורים/שכונות ללינה, כל אחד עם אופי שונה (למשל: תוסס וחיי לילה, שקט ורגוע, מרכזי ונוח, אותנטי ומקומי).",
    "- restaurants: 4 מסעדות.",
    "- attractions: 4 אטרקציות ואתרים.",
    "- experiences: 4 חוויות ודברים לעשות.",
    "לכל פריט ב-areas/restaurants/attractions/experiences: שם, תיאור מפורט של 2-3 משפטים, וטיפ פרקטי אחד.",
    "בפריטי areas — התיאור צריך להבהיר את האופי של האזור ולמי הוא מתאים.",
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

  const limit = checkRateLimit(
    `ai:city-guide:${user.id}`,
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

  const parsed = aiCityGuideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const guide = await generateStructured({
      prompt: buildPrompt(parsed.data),
      schema: aiCityGuideSchema,
    });
    return NextResponse.json(guide);
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
