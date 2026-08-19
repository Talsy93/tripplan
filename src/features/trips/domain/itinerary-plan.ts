import { normaliseName } from "@/lib/text";
import { parseTimeLabel } from "./timeline";
import type { AiItinerary, SelectedItem } from "./ai-suggestion";
import type { DayCityPlan } from "./trip-days";

// The itinerary route's use of buildDayCityPlan (trip-days.ts): turning the
// day-by-day facts into prompt text, and correcting the model's answer
// against them afterwards. Split from trip-days.ts because that file computes
// the plan from bookings and this one only ever consumes it.

function formatShortDate(date: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return match ? `${match[2]}.${match[1]}` : date;
}

// The ground-truth block the itinerary prompt gets: every day, stated
// explicitly, instead of a day *count* per city and a request to arrange it.
export function dayCityPlanPromptLines(plan: DayCityPlan[]): string {
  return plan
    .map((entry) => {
      const date = formatShortDate(entry.date);
      if (entry.kind === "lodging") {
        return `יום ${entry.day} (${date}): ${entry.city}`;
      }
      if (entry.kind === "travel") {
        return `יום ${entry.day} (${date}): יום נסיעה — עדיין לא הגעתם ליעד, אסור לתזמן בו שום פעילות`;
      }
      return `יום ${entry.day} (${date}): טרם נקבע איזו עיר`;
    })
    .join("\n");
}

// Whether the plan says anything the model doesn't already know. A plan with
// no bookings at all is every day marked "open", which adds nothing over the
// existing day-count line — the route skips sending it in that case.
export function dayCityPlanHasFacts(plan: DayCityPlan[]): boolean {
  return plan.some((entry) => entry.kind !== "open");
}

type PlanItem = { name: string; start_time: string; end_time: string; note: string };

// Corrects the model's own day numbers against the plan, so a hotel booked
// for a week in Tokyo reads as a full week in Tokyo even if the model decided
// otherwise. The model is free to order items *within* a day and to use the
// "open" days however it likes; what it cannot do is put an item in the wrong
// city's lodging days or schedule anything on a travel day — those are
// enforced here regardless of what came back.
//
// Returns `itinerary` unchanged when there is no plan to check against — an
// undated trip, or one whose day count isn't known, has nothing to reconcile.
export function reconcileItineraryWithDayPlan(
  itinerary: AiItinerary,
  selected: SelectedItem[],
  plan: DayCityPlan[] | null,
): AiItinerary {
  if (!plan || plan.length === 0) return itinerary;

  const cityByName = new Map(
    selected.map((item) => [normaliseName(item.name), item.city || null]),
  );
  const planByDay = new Map(plan.map((entry) => [entry.day, entry]));

  // Ascending because the plan itself is built day 1..N in order, so the
  // first entry per city is always its earliest lodging day.
  const lodgingDaysByCity = new Map<string, number[]>();
  for (const entry of plan) {
    if (entry.kind !== "lodging") continue;
    const key = normaliseName(entry.city);
    lodgingDaysByCity.set(key, [...(lodgingDaysByCity.get(key) ?? []), entry.day]);
  }

  const firstOpenDay = plan.find((entry) => entry.kind === "open")?.day ?? null;
  const firstDay = plan[0].day;

  function isValidDay(itemCity: string | null, day: number): boolean {
    const entry = planByDay.get(day);
    // A day outside the plan is the model overrunning the trip's length —
    // itineraryOverrun already reports that separately; guessing where to
    // move it to would just invent a second problem.
    if (!entry) return true;
    if (entry.kind === "travel") return false;
    if (entry.kind === "lodging") {
      return itemCity !== null && normaliseName(itemCity) === normaliseName(entry.city);
    }
    // "open": fine for anything without a city, or a city with no lodging
    // days anywhere. Wrong for a city that DOES have lodging days — those
    // belong there, not on a day meant for cities still undecided.
    return !itemCity || !lodgingDaysByCity.has(normaliseName(itemCity));
  }

  function targetDay(itemCity: string | null): number {
    const lodgingDays = itemCity ? lodgingDaysByCity.get(normaliseName(itemCity)) : undefined;
    return lodgingDays?.[0] ?? firstOpenDay ?? firstDay;
  }

  // Bucketed by corrected day number. Items that were already right keep
  // their day; only the wrong ones move.
  const byDay = new Map<number, PlanItem[]>();
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const itemCity = cityByName.get(normaliseName(item.name)) ?? null;
      const destination = isValidDay(itemCity, day.day) ? day.day : targetDay(itemCity);
      const bucket = byDay.get(destination) ?? [];
      bucket.push(item);
      byDay.set(destination, bucket);
    }
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, items]) => ({
      day,
      // Re-sorted by parsed start time so a moved item lands in its actual
      // place in the day rather than tacked on at the end. Unparseable times
      // keep their arrival order at the tail, the same fallback
      // buildDayTimeline uses for "no time set" entries.
      items: [...items].sort((a, b) => {
        const aTime = parseTimeLabel(a.start_time);
        const bTime = parseTimeLabel(b.start_time);
        if (aTime === null) return bTime === null ? 0 : 1;
        if (bTime === null) return -1;
        return aTime - bTime;
      }),
    }));

  return { days };
}
