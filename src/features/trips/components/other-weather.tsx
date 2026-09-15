"use client";

import { useState } from "react";
import { ChevronDown, CloudSun } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CityWeather } from "../domain/weather";
import { DayWeatherCard } from "./day-weather-card";

// The weather in the trip's other stops, folded under a single line.
//
// Today's city gets its card in the open; the rest of the route is one tap
// away rather than four more cards. Closed by default on purpose — a day in
// Tokyo does not need Bangkok's forecast in the way — and it stays closed or
// open for the rest of the page's life, not across visits: a preference that
// small is not worth a setting.
export function OtherDestinationsWeather({
  cities,
  today,
}: {
  cities: CityWeather[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const withData = cities.filter((city) => city.days.length > 0);
  if (withData.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-control px-1 py-1 text-start text-caption font-bold text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CloudSun className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {open ? "מזג האוויר בשאר היעדים" : "להציג גם את שאר היעדים"}
          {" · "}
          {withData.map((city) => city.city).join(", ")}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-settle ease-snap",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul className="flex flex-col gap-2">
          {withData.map((city) => (
            <li key={city.city}>
              <DayWeatherCard city={city.city} days={city.days} today={today} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
