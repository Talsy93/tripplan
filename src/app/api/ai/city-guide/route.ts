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
    `הכן מדריך לעיר ${city} עם המלצות בארבע קטגוריות:`,
    "מלונות, מסעדות, אטרקציות ואתרים, וחוויות ודברים לעשות.",
    context ? `הקשר הטיול: "${context}".` : "",
    "לכל קטגוריה ספק 4 המלצות.",
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
