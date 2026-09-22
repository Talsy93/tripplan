import { NextResponse } from "next/server";
import * as z from "zod";
import {
  transferOptionsSchema,
  transferRequestSchema,
} from "@/features/trips";
import {
  AiQuotaExceededError,
  AiRateLimitedError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { TransferRequest } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// How to get from the airport to where you are staying.
//
// Only ever reached from a press — the landing day offers it, nothing calls it
// while a schedule is being built. That was the owner's call and it is the right
// one: this is a question with a stable answer that most trips ask once, and
// spending a model call on every rebuild to re-derive "the Narita Express runs
// every half hour" would be paying rent on a fact.
function buildPrompt({ airport, destination, city, landsAt }: TransferRequest) {
  return [
    "אתה מדריך טיולים מקצועי שמכיר תחבורה בשדות תעופה.",
    `הנוסע נוחת ב${airport}${city ? ` (${city})` : ""} וצריך להגיע אל: ${destination}.`,
    landsAt ? `שעת הנחיתה: ${landsAt}.` : "",
    // The hour matters more than anything else here, and a model left to answer
    // in general will describe the daytime service to someone landing at 02:00.
    landsAt
      ? "התייחס לשעה: אם בשעה הזו קו מסוים לא פועל או שהתדירות נמוכה — אמור זאת, ואל תציע אותו כאילו הוא זמין."
      : "",
    "הצע 2-4 אפשרויות הגעה. לפחות אחת בתחבורה ציבורית (mode: transit) ולפחות אחת במונית או הסעה (mode: taxi), אם שתיהן קיימות במקום הזה.",
    "לכל אפשרות: שם האמצעי, משפט אחד על מה זה, משך טיפוסי מדלת לדלת, עלות משוערת ותדירות.",
    // The part that changed shape: prose became rows, because a row can carry a
    // time, a price and two ends of a map link and a sentence cannot.
    "פרקו כל אפשרות ל-legs — שלב לכל כלי תחבורה, כולל הליכות של יותר מחמש דקות.",
    "לכל שלב: mode (רכבת / אוטובוס / מונית / הליכה), from — תחנת העלייה המדויקת, to — תחנת הירידה המדויקת, durationMinutes, costText, ו-operator (מי מפעיל — למשל ״JR East״).",
    // Said explicitly because the app adds the legs up and shows the total.
    "durationMinutes של כל שלב כולל את ההמתנה לפניו, כך שסכום השלבים הוא הזמן מדלת לדלת.",
    // The one field most likely to be invented, named as forbidden rather than
    // simply left out of the schema — a model told to return rows will helpfully
    // add a URL to the operator field otherwise.
    "אל תכתוב כתובות אתרים בשום שדה. שם המפעיל בלבד.",
    "למונית או הסעה ישירה — legs ריק.",
    // Said plainly because the whole feature rests on it. The screen tells the
    // traveller these are typical figures; the model must not hand back a
    // specific departure that would make that label a lie.
    "אלה נתונים טיפוסיים ולא לוח זמנים חי — אל תמציא שעות יציאה מדויקות, תן משך ותדירות.",
    "משך הנסיעה חייב לכלול הליכה והמתנה סבירה, לא רק זמן הנסיעה עצמו.",
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

  const parsed = transferRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const limit = checkRateLimit(
    `ai:transfer:${user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const options = await generateStructured({
      prompt: buildPrompt(parsed.data),
      schema: transferOptionsSchema,
    });
    return NextResponse.json(options);
  } catch (error) {
    if (error instanceof AiRateLimitedError) {
      return NextResponse.json({ error: "ai_rate_limited" }, { status: 429 });
    }
    if (error instanceof AiQuotaExceededError) {
      return NextResponse.json({ error: "ai_quota" }, { status: 429 });
    }
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }
    console.error("transfer route failed:", error);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
