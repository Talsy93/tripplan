import { NextResponse } from "next/server";
import * as z from "zod";
import {
  aiItineraryRequestSchema,
  aiItinerarySchema,
  APP_TIME_ZONE,
  buildDayCityPlan,
  categoryLabel,
  cityDayPlan,
  cityDaysPromptLine,
  dayCityPlanHasFacts,
  dayCityPlanPromptLines,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  isSchemaOutOfDate,
  listBookings,
  listCityDays,
  reconcileItineraryWithDayPlan,
  saveItinerary,
  tripDayCount,
} from "@/features/trips";
import {
  AiQuotaExceededError,
  AiRateLimitedError,
  AiUnavailableError,
  generateStructured,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Booking, DayCityPlan, SelectedItem } from "@/features/trips";
import type { Trip } from "@/features/trips";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// The lodging, as a statement of where the trip sleeps on which dates.
//
// This was the whole gap: the prompt used to receive the trip name, its dates
// and a flat list of items, and nothing else. A hotel booked for three nights in
// Rome had no influence at all, so the model could return five days in Rome and
// none in Florence while the app went on showing the Rome hotel beside a
// Florence day. Bookings are the strongest statement of intent that already
// exists — they were paid for — and they were being ignored.
function lodgingLines(bookings: Booking[]) {
  return bookings
    .filter((b) => b.kind === "lodging" && b.city)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((b) => {
      const from = b.starts_at.slice(0, 10);
      const to = b.ends_at?.slice(0, 10);
      return to ? `- ${b.city}: ${from} עד ${to}` : `- ${b.city}: מ-${from}`;
    });
}

function buildPrompt(
  trip: Trip,
  items: SelectedItem[],
  bookings: Booking[],
  cityDaysLine: string | null,
  dayPlan: DayCityPlan[] | null,
) {
  const lodging = lodgingLines(bookings);
  const list = items
    .map(
      (item) =>
        `- ${item.name} (${item.city}, ${categoryLabel(item.category)})`,
    )
    .join("\n");

  // When the plan has real facts (a lodging or travel day from an actual
  // booking), it replaces the day-count line entirely: it already says which
  // city every such day belongs to, which is strictly more specific than "N
  // days somewhere in this list" — and the app enforces it afterwards
  // regardless of what the model does with it (see reconcileItineraryWithDayPlan),
  // so there is no reason to also ask for the weaker version.
  const hasDayPlan = dayPlan !== null && dayCityPlanHasFacts(dayPlan);

  return [
    "אתה מתכנן טיולים מקצועי.",
    `בנה לו"ז יומי לטיול "${trip.name}".`,
    trip.start_date && trip.end_date
      ? `תאריכי הטיול: ${trip.start_date} עד ${trip.end_date}.`
      : "אין תאריכים קבועים — קבע מספר ימים סביר לפי כמות הפריטים.",

    hasDayPlan &&
      "התאריך והעיר של כל יום נקבעו מראש ואסור לשנות אותם. מספרי הימים בתשובה שלך חייבים להתאים בדיוק למספרים למטה:",
    hasDayPlan && dayCityPlanPromptLines(dayPlan!),
    hasDayPlan &&
      "מקמו כל פריט רק ביום שהעיר שלו מתוזמנת בו, ולעולם לא ביום נסיעה.",

    // Stated as a constraint, not as background. The model is being told the
    // answer to "how many days in each city", because the user already decided
    // it — either explicitly or by booking a hotel. Falls back to this weaker
    // form only when there is no day-by-day plan to give instead.
    !hasDayPlan &&
      cityDaysLine &&
      `חלוקת הימים בין הערים נקבעה מראש ואסור לשנות אותה: ${cityDaysLine}.`,
    !hasDayPlan &&
      cityDaysLine &&
      "עיר שלא מופיעה בחלוקה הזו — קבע לה מספר ימים סביר מהימים שנשארו.",

    !hasDayPlan && lodging.length > 0 && "הלינה שהוזמנה (אלה התאריכים שבהם ישנים בכל עיר):",
    !hasDayPlan && lodging.length > 0 && lodging.join("\n"),
    !hasDayPlan &&
      lodging.length > 0 &&
      "סדר את הימים כך שכל פריט יופיע ביום שבו הטיול נמצא בעיר שלו לפי הלינה.",

    "הפריטים שנבחרו לטיול:",
    list,
    "סדר אותם לימים ולפי שעות (מהבוקר לערב), בהתחשב בקרבה גאוגרפית ובזרימה טבעית של יום טיול.",
    'לכל פריט: name (מתוך הרשימה), start_time ו-end_time בפורמט "HH:MM", ו-note קצר.',
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

  const parsed = aiItineraryRequestSchema.safeParse(body);
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
    `ai:itinerary:${user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  const [trip, items, bookings, overrides] = await Promise.all([
    getTrip(tripId),
    getSelectedDestinations(tripId),
    listBookings(tripId),
    listCityDays(tripId),
  ]);

  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "no_selection" }, { status: 400 });
  }

  // Cities in the order they were added, which is the order every other surface
  // colours them in.
  const cities = [...new Set(items.map((item) => item.city))].filter(Boolean);
  const cityDaysLine = cityDaysPromptLine(
    cityDayPlan(cities, bookings, overrides),
  );

  // Only possible with a fixed start and end date — an open-ended trip has no
  // fixed day count to build a day-by-day plan against, and falls back to the
  // weaker city-days line above exactly as before.
  const dayCount = tripDayCount(trip.start_date, trip.end_date);
  const dayPlan =
    trip.start_date && dayCount
      ? buildDayCityPlan(trip.start_date, dayCount, bookings, APP_TIME_ZONE)
      : null;

  try {
    const itinerary = await generateStructured({
      prompt: buildPrompt(trip, items, bookings, cityDaysLine, dayPlan),
      schema: aiItinerarySchema,
    });
    const reconciled = reconcileItineraryWithDayPlan(
      itinerary,
      items,
      dayPlan && dayCityPlanHasFacts(dayPlan) ? dayPlan : null,
    );
    const { error: saveError } = await saveItinerary(tripId, reconciled, items);

    // A save that failed must not answer 200 with an empty itinerary. That is
    // exactly what happened before: the write failed, the route reported
    // success, and the client rendered the empty state — "I pressed build and
    // nothing happened".
    if (saveError) {
      console.error("itinerary save failed:", saveError);
      return NextResponse.json(
        {
          error: isSchemaOutOfDate(saveError)
            ? "schema_out_of_date"
            : "save_failed",
        },
        { status: 500 },
      );
    }
    // The trip's phase is derived from its dates now (ARCHITECTURE.md #6).
    // This used to set status to 'executing' here, which claimed a trip was
    // under way the moment its itinerary was generated — often months early.
    // Return the persisted itinerary so the client has row ids (for deletion).
    const saved = await getItinerary(tripId);
    return NextResponse.json({ days: saved });
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
