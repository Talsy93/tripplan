import { Droplet } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeWeather, weekdayLabel } from "../domain/weather";
import type { DailyWeather } from "../domain/weather";
import type { DomainIconName } from "../domain/icons";
import { DomainIcon } from "./domain-icon";

// The colour a weather glyph is drawn in (Pencil, v7): sun in amber, rain in
// sky blue, everything grey in the outline ink. Through the .tone-* trios, so
// it stays on the palette's own tokens rather than a hex written here.
export function weatherToneClass(icon: DomainIconName): string {
  switch (icon) {
    case "clear":
    case "partly-cloudy":
      return "tone-amber text-tone-dot";
    case "drizzle":
    case "rain":
    case "showers":
    case "thunder":
      return "tone-sky text-tone-dot";
    default:
      return "text-outline";
  }
}

// Four days of weather for one city, in the context pane.
//
// Distinct from WeatherForecast, which draws every city in the trip across the
// whole forecast window and scrolls sideways — the right thing on a page about
// the trip, and far too much for a 372px pane on the day screen. Here the
// question is narrow: what is it doing where I am, today and the next few days.
//
// One white card with the days as columns and no box around each (Pencil's
// forecast row); today alone gets a teal tint, since it is the one you are
// standing in.
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
    <div className="flex min-w-0 flex-col gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card">
      <span className="min-w-0 text-base leading-6 font-bold text-foreground wrap-anywhere">מזג האוויר ב{city}</span>

      <ul className="flex gap-1">
        {days.slice(0, 4).map((day) => {
          const described = describeWeather(day.code);
          const isToday = today != null && day.date === today;

          return (
            <li key={day.date} className="min-w-0 flex-1">
              <div
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center",
                  isToday && "bg-primary-tint",
                )}
              >
                <span
                  className={cn(
                    "min-w-0 truncate text-xs",
                    isToday ? "font-semibold text-primary" : "text-muted",
                  )}
                >
                  {isToday ? "היום" : weekdayLabel(day.date).split(",")[0]}
                </span>
                <span
                  className={weatherToneClass(described.icon)}
                  title={described.label}
                  aria-label={described.label}
                >
                  <DomainIcon name={described.icon} className="h-6 w-6" />
                </span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {Math.round(day.maxC)}°
                </span>
                <span className="text-xs tabular-nums text-muted">
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
    </div>
  );
}
