import { Droplet } from "lucide-react";
import { Banner, Surface } from "@/components/ui";
import { describeWeather, weekdayLabel } from "../domain/weather";
import type { CityWeather, ForecastWindow } from "../domain/weather";
import { weatherToneClass } from "./day-weather-card";
import { DomainIcon } from "./domain-icon";

// Presentational: the panel resolves the window and the data, this draws it.
//
// Pencil's forecast row (v7): "תחזית ב…" and one white card per city with the
// days as columns — weekday, the sky in its colour, the high. No box per day;
// the card is the box. A long trip scrolls sideways inside it rather than
// wrapping, so a two-week forecast stays one row per city.
export function WeatherForecast({
  window,
  cities,
}: {
  window: ForecastWindow;
  cities: CityWeather[];
}) {
  if (window.kind === "past") {
    return <Banner tone="info">הטיול הזה כבר מאחוריכם.</Banner>;
  }

  // Not an error state — the forecast genuinely doesn't exist yet, and saying
  // when it will is more useful than an empty panel.
  if (window.kind === "too-far") {
    return (
      <Surface tone="quiet" className="flex flex-col gap-1 rounded-[1.25rem]">
        <p className="text-base font-semibold">התחזית עוד לא קיימת</p>
        <p className="text-sm text-muted">
          תחזית זמינה עד 16 ימים קדימה. נתחיל להציג אותה בעוד{" "}
          {window.daysUntilAvailable === 1
            ? "יום"
            : `${window.daysUntilAvailable} ימים`}
          .
        </p>
      </Surface>
    );
  }

  const withData = cities.filter((city) => city.days.length > 0);
  if (withData.length === 0) {
    return (
      <Banner tone="danger">
        לא הצלחנו להביא תחזית ליעדים של הטיול. נסו שוב מאוחר יותר.
      </Banner>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {withData.map((city) => (
        <section key={city.city} className="flex min-w-0 flex-col gap-3">
          <h2 className="min-w-0 text-base leading-6 font-bold text-foreground wrap-anywhere">
            תחזית ב{city.city}
          </h2>
          <div className="min-w-0 rounded-[1.25rem] bg-surface px-2 py-4 shadow-card">
            <ul className="flex overflow-x-auto">
              {city.days.map((day) => {
                const { icon, label } = describeWeather(day.code);
                return (
                  <li
                    key={day.date}
                    className="flex min-w-[3.75rem] flex-1 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <span className="text-xs text-muted" title={weekdayLabel(day.date)}>
                      {weekdayLabel(day.date).split(",")[0]}
                    </span>
                    <span
                      className={weatherToneClass(icon)}
                      title={label}
                      aria-label={label}
                    >
                      <DomainIcon name={icon} className="h-6 w-6" />
                    </span>
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {Math.round(day.maxC)}°
                    </span>
                    <span className="text-xs tabular-nums text-muted">
                      {day.rainChance !== null && day.rainChance > 0 ? (
                        <>
                          <Droplet className="inline h-3 w-3 align-[-1px]" aria-hidden="true" />{" "}
                          {day.rainChance}%
                        </>
                      ) : (
                        `${Math.round(day.minC)}°`
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
