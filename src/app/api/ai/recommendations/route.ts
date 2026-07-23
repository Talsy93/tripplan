import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiMoreRecommendationsRequestSchema,
  aiRecommendationsSchema,
} from "@/features/trips";
import { generateStructured } from "@/lib/ai";
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
}: AiMoreRecommendationsRequest) {
  return [
    "אתה מדריך טיולים מקצועי.",
    `הצע ${count} המלצות נוספות בקטגוריה "${CATEGORY_LABELS[category]}" בעיר ${city}.`,
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
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
