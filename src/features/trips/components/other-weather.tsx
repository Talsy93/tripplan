import { CloudSun } from "lucide-react";
import { Disclosure } from "@/components/ui";
import type { CityWeather } from "../domain/weather";
import { DayWeatherCard } from "./day-weather-card";

// The weather in the trip's other stops, folded under a single line.
//
// Today's city gets its card in the open; the rest of the route is one tap
// away rather than four more cards. Closed by default on purpose — a day in
// Tokyo does not need Bangkok's forecast in the way.
//
// This was a `useState` toggle with its own chevron until the Disclosure
// primitive arrived. Moving it over cost the component its "use client": the
// open state belongs to the browser's <details>, and nothing else here needed
// the client bundle. The label no longer changes between "show" and "showing"
// either — the city names were always the part worth reading, and the chevron
// says which way the section is facing.
export function OtherDestinationsWeather({
  cities,
  today,
}: {
  cities: CityWeather[];
  today: string;
}) {
  const withData = cities.filter((city) => city.days.length > 0);
  if (withData.length === 0) return null;

  return (
    <Disclosure
      leading={<CloudSun className="h-4 w-4" />}
      title="מזג האוויר בשאר היעדים"
      detail={withData.map((city) => city.city).join(", ")}
    >
      <ul className="flex flex-col gap-2">
        {withData.map((city) => (
          <li key={city.city}>
            <DayWeatherCard city={city.city} days={city.days} today={today} />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
