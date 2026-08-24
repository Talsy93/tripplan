import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiMoreRecommendationsRequestSchema,
  aiRecommendationsSchema,
} from "@/features/trips";
import {
  AiQuotaExceededError,
  AiRateLimitedError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AiCategoryKey, AiMoreRecommendationsRequest } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const CATEGORY_LABELS: Record<AiCategoryKey, string> = {
  areas: "אזורי לינה (שכונות לפי אופי)",
  restaurants: "מסעדות",
  attractions: "אטרקציות ואתרים",
  experiences: "חוויות ודברים לעשות",
};

function buildPrompt({
  city,
  category,
  context,
  exclude = [],
  count = 4,
  area,
}: AiMoreRecommendationsRequest) {
  return [
    "אתה מדריך טיולים מקצועי.",
    area
      ? `הצע ${count} המלצות בקטגוריה "${CATEGORY_LABELS[category]}" באזור ${area} שבעיר ${city}.`
      : `הצע ${count} המלצות נוספות בקטגוריה "${CATEGORY_LABELS[category]}" בעיר ${city}.`,
    // Said explicitly because the failure mode is quiet and plausible: asked
    // for "Omotesando", a model will happily answer with the city's famous
    // places instead, and the list looks right until you notice nothing on it
    // is in the district that was asked about.
    area
      ? `חשוב: כל ההמלצות חייבות להיות ממש באזור ${area} או במרחק הליכה ממנו — לא במקומות אחרים בעיר. אם אין באזור מספיק מקומות בקטגוריה הזו, החזירו פחות המלצות במקום להרחיב לאזורים אחרים.`
      : "",
    area
      ? `ציינו בתיאור מה מייחד את המקום דווקא באזור ${area}.`
      : "",
    context ? `הקשר הטיול: "${context}".` : "",
    exclude.length
      ? `אל תכלול את ההמלצות הבאות שכבר הוצגו: ${exclude.join(", ")}.`
      : "",
    "לכל המלצה: שם, תיאור מפורט של 2-3 משפטים, וטיפ פרקטי אחד.",
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
    `ai:recommendations:${user.id}`,
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

  const parsed = aiMoreRecommendationsRequestSchema.safeParse(body);
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
    const result = await generateStructured({
      prompt: buildPrompt(parsed.data),
      schema: aiRecommendationsSchema,
    });
    return NextResponse.json(result);
  } catch (error) {
    // Google's per-minute cap. Answered as 429 with the delay it asked for, so
    // the reader is told to wait seconds rather than until tomorrow.
    if (error instanceof AiRateLimitedError) {
      return NextResponse.json(
        {
          error: "ai_rate_limited",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
    if (error instanceof AiQuotaExceededError) {
      return NextResponse.json({ error: "ai_quota_exceeded" }, { status: 503 });
    }
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_busy" }, { status: 503 });
    }
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
