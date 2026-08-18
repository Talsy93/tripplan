import { NextResponse } from "next/server";
import * as z from "zod";
import { aiSuggestRequestSchema, aiCitySuggestionsSchema } from "@/features/trips";
import {
  AiQuotaExceededError,
  AiRateLimitedError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AiSuggestRequest } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function buildPrompt({ prompt, count = 5, exclude = [] }: AiSuggestRequest) {
  return [
    "אתה מתכנן טיולים מקצועי.",
    `הצע ${count} ערים או אזורים מתאימים לבקשה הבאה:`,
    `"${prompt}"`,
    // Without this, "more destinations" returns the same five reworded. The
    // client also drops duplicates on the way back in, because a prompt is a
    // request and not a guarantee.
    exclude.length > 0
      ? `אל תציע את הערים הבאות שכבר הוצגו: ${exclude.join(", ")}. הצע ערים אחרות לגמרי.`
      : "",
    "לכל עיר ספק שם ומשפט קצר שמסביר למה היא מתאימה.",
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
      schema: aiCitySuggestionsSchema,
    });
    return NextResponse.json(suggestions);
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
