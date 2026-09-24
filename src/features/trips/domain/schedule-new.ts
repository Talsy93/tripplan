import { normaliseName } from "@/lib/text";
import { withEmptyDays } from "./itinerary-plan";
import { dateOfDay } from "./trip-days";
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
//
// Two ways in share the rules below: the automatic one (planPlacements, every
// pending place at once) and the manual one (buildSchedulingPlan, which hands
// the sheet the same pending list and the days to choose from, one at a time).

// Rows that are not places to visit: the city's own overview, and the AI
// guide's "areas" (where to stay).
const NOT_A_STOP = new Set(["overview", "areas"]);

export function isStop(place: Pick<SelectedItem, "category">): boolean {
  return !NOT_A_STOP.has(place.category);
}

// Every title already on the schedule, normalised — a place is "scheduled" when
// its name is on some day, whichever way it got there.
export function scheduledNames(days: ItineraryDay[]): Set<string> {
  return new Set(
    days.flatMap((day) => day.items.map((item) => normaliseName(item.title))),
  );
}

// The chosen places that are not on any day yet: stops only, each name once, in
// the order they were chosen.
export function pendingPlaces(
  places: SelectedItem[],
  days: ItineraryDay[],
): SelectedItem[] {
  const scheduled = scheduledNames(days);
  const seen = new Set<string>();
  const pending: SelectedItem[] = [];
  for (const place of places) {
    if (!isStop(place)) continue;
    const key = normaliseName(place.name);
    if (scheduled.has(key) || seen.has(key)) continue;
    seen.add(key);
    pending.push(place);
  }
  return pending;
}

// A day's city is the city most of its entries are in. Null for a day with no
// city on any entry (a travel day, a free day) — nothing says where it is.
export function dayCity(day: ItineraryDay): string | null {
  const counts = new Map<string, number>();
  for (const item of day.items) {
    if (item.city) counts.set(item.city, (counts.get(item.city) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Which city every day is in, for a screen that has to name the empty ones too.
// The entries decide first; then where the trip sleeps that night; then the
// previous day's city, carried forward — an empty day after three in Tokyo is a
// day in Tokyo. The same order the itinerary's own cityOfDay uses.
export function dayCities(
  days: ItineraryDay[],
  lodgingCity: ReadonlyMap<number, string> = new Map(),
): Map<number, string> {
  const cities = new Map<number, string>();
  let carried: string | null = null;
  for (const day of days) {
    const city: string | null = dayCity(day) ?? lodgingCity.get(day.day) ?? carried;
    if (city) {
      cities.set(day.day, city);
      carried = city;
    }
  }
  return cities;
}

export type Placement = { dayNumber: number; city: string; name: string };

export function planPlacements(
  places: SelectedItem[],
  days: ItineraryDay[],
): { placements: Placement[]; unplaced: SelectedItem[] } {
  // Only a day whose own entries name a city is a candidate here: the automatic
  // path has no one to ask, so it does not guess where an empty day is.
  const load = new Map<number, number>();
  const cityDays = new Map<string, number[]>();
  for (const day of days) {
    load.set(day.day, day.items.length);
    const city = dayCity(day);
    if (city) cityDays.set(city, [...(cityDays.get(city) ?? []), day.day]);
  }

  const placements: Placement[] = [];
  const unplaced: SelectedItem[] = [];
  for (const place of pendingPlaces(places, days)) {
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

// What the manual scheduling sheet and the planning page need: the places still
// waiting, and every day of the trip with its city, date and what is on it.
export type SchedulingDay = {
  day: number;
  city: string | null;
  date: string | null;
  // The titles on the day, in order. `items.length` is the day's load.
  items: string[];
};

export type SchedulingPlan = {
  pending: { name: string; city: string; category: string }[];
  days: SchedulingDay[];
  // False before the first build: there are no days to put anything into, and
  // the build is the model's job, on מסלול.
  hasItinerary: boolean;
};

export function buildSchedulingPlan({
  itinerary,
  selected,
  startDate,
  dayCount,
  lodgingCity,
}: {
  itinerary: ItineraryDay[];
  selected: SelectedItem[];
  startDate: string | null;
  // The trip's own length, or null for a dateless trip.
  dayCount: number | null;
  lodgingCity?: ReadonlyMap<number, string>;
}): SchedulingPlan {
  const hasItinerary = itinerary.some((day) => day.items.length > 0);
  const days = hasItinerary
    ? (withEmptyDays(itinerary, dayCount) as ItineraryDay[])
    : [];
  const cities = dayCities(days, lodgingCity);

  return {
    pending: pendingPlaces(selected, itinerary).map(({ name, city, category }) => ({
      name,
      city,
      category,
    })),
    days: days.map((day) => ({
      day: day.day,
      city: cities.get(day.day) ?? null,
      date: dateOfDay(startDate, day.day),
      items: day.items.map((item) => item.title),
    })),
    hasItinerary,
  };
}

// The days a place can go to: its own city's, or every day when its city has
// none (a city added after the build). The lightest of them — fewest entries,
// the earlier on a tie — is the one the sheet marks "הכי פנוי".
export function daysForPlace(
  city: string,
  days: SchedulingDay[],
  load: (day: SchedulingDay) => number = (day) => day.items.length,
): { days: SchedulingDay[]; ownCity: boolean; lightest: number | null } {
  const own = days.filter((day) => day.city === city);
  const shown = own.length > 0 ? own : days;
  const lightest =
    [...shown].sort((a, b) => load(a) - load(b) || a.day - b.day)[0]?.day ?? null;
  return { days: shown, ownCity: own.length > 0, lightest };
}
