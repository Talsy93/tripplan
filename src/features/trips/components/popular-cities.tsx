import { popularCitiesForTrip } from "@/lib/popular-cities";
import { PopularCityChips } from "./popular-city-chips";

// "ערים פופולריות ב<מדינה>" — the first thing a new trip's planning page
// offers (2026-09-25). A trip is born with a name and nothing else, and the
// search below needs a city to search in; this turns the name into the cities
// worth starting from, one press each. See lib/popular-cities.ts for where
// they come from (Wikidata — free, no AI).
//
// Streamed: the lookup can take seconds on a cold country, and the rest of the
// page must not wait for it. Renders nothing when the name points nowhere.
export async function PopularCities({
  tripId,
  tripName,
  exclude,
}: {
  tripId: string;
  tripName: string;
  // Cities the trip already has, which are not suggested again.
  exclude: string[];
}) {
  const found = await popularCitiesForTrip(tripName);
  if (!found) return null;

  const taken = new Set(exclude);
  const cities = found.cities.filter((city) => !taken.has(city)).slice(0, 8);
  if (cities.length === 0) return null;

  return <PopularCityChips tripId={tripId} country={found.country} cities={cities} />;
}
