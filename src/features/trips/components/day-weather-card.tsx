import { Droplet } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { describeWeather, weekdayLabel } from "../domain/weather";
import type { DailyWeather } from "../domain/weather";
import { DomainIcon } from "./domain-icon";

// Four days of weather for one city, in the context pane.
//
// Distinct from WeatherForecast, which draws every city in the trip across the
// whole forecast window and scrolls sideways — the right thing on a page about
// the trip, and far too much for a 372px pane on the day screen. Here the
// question is narrow: what is it doing where I am, today and the next few days.
//
// Presentational. The caller fetches, because the fetch needs the server and a
// city's coordinates.
export function DayWeatherCard({
  city,
  days,
  // Which date is "today", so one tile can be marked. Null when the caller has
  // no current day, and then nothing is marked.
  today,
}: {
  city: string;
  days: DailyWeather[];
  today?: string | null;
}) {
  if (days.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2.5">
      <span className="text-sm font-bold">מזג האוויר ב{city}</span>

      <ul className="flex gap-1.5">
        {days.slice(0, 4).map((day) => {
          const described = describeWeather(day.code);
          const isToday = today != null && day.date === today;

          return (
            <li key={day.date} className="min-w-0 flex-1">
              <div
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-control px-1 py-2 text-center",
                  // The action tint marks today, which is the one tile you are
                  // actually standing in. Everything else is the quiet surface.
                  isToday ? "bg-primary-tint" : "bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "min-w-0 truncate text-caption font-bold",
                    isToday ? "text-primary-ink" : "text-muted",
                  )}
                >
                  {isToday ? "היום" : weekdayLabel(day.date).split(",")[0]}
                </span>
                <span
                  className="text-tone-ink"
                  title={described.label}
                  aria-label={described.label}
                >
                  <DomainIcon name={described.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-black tabular-nums">
                  {Math.round(day.maxC)}°
                </span>
                <span className="text-caption tabular-nums text-muted">
                  {day.rainChance !== null && day.rainChance > 0 ? (
                    <>
                      <Droplet
                        className="inline h-3 w-3 align-[-1px]"
                        aria-hidden="true"
                      />{" "}
                      {day.rainChance}%
                    </>
                  ) : (
                    `${Math.round(day.minC)}°`
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
