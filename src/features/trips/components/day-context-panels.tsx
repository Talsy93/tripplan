import { getDailyForecast } from "@/lib/weather";
import { addDays } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import { DayMapCard } from "./day-map-card";
import { DayWeatherCard } from "./day-weather-card";
import type { ItineraryDay } from "../domain/ai-suggestion";

// The two panels on the day screen's context pane that have to go to the
// network. Fetchers, each paired with the presentational card it fills — the
// same split WeatherPanel and WeatherForecast already use, and the reason is the
// same: the card can then have a scene in the harness, which a component that
// calls Overpass cannot.
//
// Each one wants its own <Suspense> at the call site. Resolving the route may
// need to geocode a city (paced at about a request per second) and the forecast
// is a second host; neither may hold up the "now" card, which is the part
// somebody actually opened the app for.

// "התחנות של היום" — the day's located places, on the city they are in.
export async function DayStopsPanel({
  tripId,
  tripName,
  day,
  // Which city the day is in. The map frames this city rather than the whole
  // route: a day in Kyoto zoomed out to fit Tokyo is a map of neither.
  city,
}: {
  tripId: string;
  tripName: string;
  day: ItineraryDay;
  city: string | null;
}) {
  const route = await getTripRoute(tripId, tripName);
  const stop = route.stops.find((candidate) => candidate.city === city);
  // No stop for this city means it never geocoded, and there is nothing to
  // frame. The map tab says so properly; a pane is not the place to explain it.
  if (!stop) return null;

  // Only the day's own items, and only the ones that have coordinates — an AI
  // guide item is a name and nothing more. Matched by name against the route's
  // places, which is where the coordinates live.
  const names = new Set(day.items.map((item) => item.title));
  const places = route.places.filter(
    (place) => place.city === stop.city && names.has(place.name),
  );

  return <DayMapCard tripId={tripId} stops={[stop]} places={places} />;
}

// Four days of weather where the trip is today.
export async function DayForecastPanel({
  tripId,
  tripName,
  city,
  // The day being shown, YYYY-MM-DD. The window starts here rather than at the
  // real today, so looking at day 4 shows day 4's weather.
  date,
}: {
  tripId: string;
  tripName: string;
  city: string | null;
  date: string;
}) {
  // Coordinates come from the route the map already resolved and cached, so this
  // costs no geocoding — the same reason TodayStats reads it.
  const route = await getTripRoute(tripId, tripName);
  const stop =
    route.stops.find((candidate) => candidate.city === city) ??
    route.stops[0] ??
    null;
  if (!stop) return null;

  const days = await getDailyForecast({
    latitude: stop.latitude,
    longitude: stop.longitude,
    startDate: date,
    endDate: addDays(date, 3),
  });
  if (!days || days.length === 0) return null;

  return <DayWeatherCard city={stop.city} days={days} today={date} />;
}
