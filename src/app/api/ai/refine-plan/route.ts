import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiTripPlanSchema,
  getTrip,
  refinePlanRequestSchema,
} from "@/features/trips";
import {
  AiQuotaExceededError,
  AiRateLimitedError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AiTripPlan } from "@/features/trips";

// Tighter than plan-from-chat's five. Tuning is the call you make repeatedly —
// swap the restaurant, now make it vegetarian, now less walking — and each one
// is a whole model round. Three a minute is enough to iterate and not enough to
// spend the day's quota on one plan.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

// The same plan, changed as asked.
//
// Built for the tuning row the Stitch export draws under its day-plan card —
// "swap the lunch place", "make it vegetarian". Those are not a new plan: the
// traveller has one they are broadly happy with and wants one thing different,
// and re-deriving the whole thing from the conversation would throw away
// everything they did not complain about.
//
// So the current plan goes into the prompt as the thing to keep, and the
// instruction as the thing to change. Like plan-from-chat, this route only
// proposes — nothing is written here, and the answer goes back for the
// traveller to look at.
function buildPrompt(
  tripName: string,
  plan: AiTripPlan,
  instruction: string,
): string {
  const current = plan.cities
    .map((city) =>
      [
        `עיר: ${city.name}`,
        `תיאור: ${city.intro}`,
        ...city.items.map(
          (item) => `- ${item.name} [${item.category}]: ${item.description}`,
        ),
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "אתה מתכנן טיולים מקצועי.",
    `להלן מסלול מוצע לטיול "${tripName}", והמטייל ביקש בו שינוי אחד.`,
    "",
    "--- המסלול הנוכחי ---",
    `סיכום: ${plan.summary}`,
    current,
    "--- סוף המסלול ---",
    "",
    `הבקשה של המטייל: "${instruction}"`,
    "",
    // The instruction that makes this a revision rather than a regeneration.
    // Without it the model rewrites the lot, and the traveller who asked to
    // change lunch loses the evening they liked.
    "החזר את אותו מסלול עם השינוי המבוקש בלבד.",
    "כל מה שהבקשה לא נגעה בו — ערים, פריטים, תיאורים — חייב לחזור כפי שהוא, באותו סדר.",
    "אל תוסיף ואל תסיר פריטים שלא נדרשו.",
    "",
    "החזר:",
    "- summary: משפט או שניים, מעודכן אם השינוי משנה אותו.",
    "- cities: כמו קודם. לכל עיר name, intro ו-items.",
    "- לכל item: name, description, ו-category מתוך: areas, restaurants, attractions, experiences.",
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = refinePlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const { tripId, plan, instruction } = parsed.data;

  const limit = checkRateLimit(
    `ai:refine:${user.id}`,
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
  // a trip the caller cannot see. It matters here even though the plan arrives
  // in the body: without it, anyone signed in could spend the owner's quota by
  // posting a plan and someone else's trip id.
  const trip = await getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const revised = await generateStructured({
      prompt: buildPrompt(trip.name, plan, instruction),
      schema: aiTripPlanSchema,
    });
    return NextResponse.json(revised);
  } catch (error) {
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
