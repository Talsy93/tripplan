import { NextResponse } from "next/server";
import * as z from "zod";
import { aiSuggestRequestSchema, aiSuggestionsSchema } from "@/features/trips";
import { generateStructured } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AiSuggestRequest } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function buildPrompt({ prompt, count = 5 }: AiSuggestRequest) {
  return [
    "אתה מתכנן טיולים מקצועי.",
    `הצע ${count} יעדים מומלצים עבור הבקשה הבאה:`,
    `"${prompt}"`,
    "לכל יעד ספק שם, תיאור קצר, ומשך ביקור משוער בדקות.",
    "השב בעברית.",
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

  const limit = checkRateLimit(`ai:suggest:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
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

  const parsed = aiSuggestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  try {
    const suggestions = await generateStructured({
      prompt: buildPrompt(parsed.data),
      schema: aiSuggestionsSchema,
    });
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
