import { getDailyForecast } from "@/lib/weather";
import { APP_TIME_ZONE, forecastWindow, todayIn } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import { WeatherForecast } from "./weather-forecast";
import type { CityWeather } from "../domain/weather";
import type { Trip } from "../domain/trip";

// Server component: works out whether a forecast can exist at all, and only
// then goes to the network. Wrap it in <Suspense> — it fans out one request
// per city.
//
// Coordinates come from the route the map already resolved and cached, so this
// costs no geocoding.
export async function WeatherPanel({ trip }: { trip: Trip }) {
  // The same fixed calendar the day view reckons by. Reading the host's clock
  // instead — on Vercel, UTC — shifts the 16-day forecast horizon by a day near
  // midnight, against what the itinerary is showing on the same screen.
  const window = forecastWindow(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
  );

  if (window.kind !== "available") {
    return <WeatherForecast window={window} cities={[]} />;
  }

  const route = await getTripRoute(trip.id, trip.name);
  if (route.stops.length === 0) {
    return <WeatherForecast window={window} cities={[]} />;
  }

  // One request per city. Open-Meteo answers in a fraction of a second and
  // asks for no key, so these go together rather than in sequence.
  const cities: CityWeather[] = await Promise.all(
    route.stops.map(async (stop) => ({
      city: stop.city,
      days:
        (await getDailyForecast({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startDate: window.startDate,
          endDate: window.endDate,
        })) ?? [],
    })),
  );

  return <WeatherForecast window={window} cities={cities} />;
}
