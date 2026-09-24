import { normaliseName } from "@/lib/text";
import type { ItineraryDay, SelectedItem } from "./ai-suggestion";

// "שיבוץ לימים" from the add-places screen: put the places chosen since the
// schedule was built into the days that already exist, without rebuilding it.
//
// The full build (/api/ai/itinerary) is the other way to get a place into a
// day, and it is the wrong tool here: it asks the model for a whole new
// schedule, so a person who added two cafés loses every hand-made change to
// fit them in, and it spends a call from a 20-a-day quota to do it. This is
// deterministic and local — a place goes to a day of its own city, the
// lightest one first — so pressing it twice changes nothing the second time.

// Rows that are not places to visit: the city's own overview, and the AI
// guide's "areas" (where to stay).
const NOT_A_STOP = new Set(["overview", "areas"]);

export type Placement = { dayNumber: number; city: string; name: string };

export function planPlacements(
  places: SelectedItem[],
  days: ItineraryDay[],
): { placements: Placement[]; unplaced: SelectedItem[] } {
  const scheduled = new Set(
    days.flatMap((day) => day.items.map((item) => normaliseName(item.title))),
  );

  // A day's city is the city most of its entries are in. A day with no city on
  // any entry (a travel day, a free day) is not a candidate — there is nothing
  // to say which city it belongs to.
  const load = new Map<number, number>();
  const cityDays = new Map<string, number[]>();
  for (const day of days) {
    load.set(day.day, day.items.length);
    const counts = new Map<string, number>();
    for (const item of day.items) {
      if (item.city) counts.set(item.city, (counts.get(item.city) ?? 0) + 1);
    }
    const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (city) cityDays.set(city, [...(cityDays.get(city) ?? []), day.day]);
  }

  const placements: Placement[] = [];
  const unplaced: SelectedItem[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    if (NOT_A_STOP.has(place.category)) continue;
    const key = normaliseName(place.name);
    if (scheduled.has(key) || seen.has(key)) continue;
    seen.add(key);

    const candidates = cityDays.get(place.city) ?? [];
    if (candidates.length === 0) {
      unplaced.push(place);
      continue;
    }
    // Lightest day first; the earlier one on a tie, so the result is the same
    // every time for the same schedule.
    const dayNumber = [...candidates].sort(
      (a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || a - b,
    )[0];
    load.set(dayNumber, (load.get(dayNumber) ?? 0) + 1);
    placements.push({ dayNumber, city: place.city, name: place.name });
  }

  return { placements, unplaced };
}
