import { Card } from "@/components/ui";
import { describeWeather, weekdayLabel } from "../domain/weather";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { CityWeather, ForecastWindow } from "../domain/weather";

// Presentational: the panel resolves the window and the data, this draws it.
export function WeatherForecast({
  window,
  cities,
}: {
  window: ForecastWindow;
  cities: CityWeather[];
}) {
  if (window.kind === "past") {
    return <p className="text-sm text-muted">הטיול הזה כבר מאחוריכם.</p>;
  }

  // Not an error state — the forecast genuinely doesn't exist yet, and saying
  // when it will is more useful than an empty panel.
  if (window.kind === "too-far") {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <p className="font-semibold">התחזית עוד לא קיימת</p>
        <p className="text-sm text-muted">
          תחזית זמינה עד 16 ימים קדימה. נתחיל להציג אותה בעוד{" "}
          {window.daysUntilAvailable === 1
            ? "יום"
            : `${window.daysUntilAvailable} ימים`}
          .
        </p>
      </Card>
    );
  }

  // Tones come from the full city list, not the filtered one, so a city whose
  // forecast failed doesn't shift the colours of the ones after it.
  const tones = cityToneMap(cities.map((city) => city.city));

  const withData = cities.filter((city) => city.days.length > 0);
  if (withData.length === 0) {
    return (
      <p className="text-sm text-muted">
        לא הצלחנו להביא תחזית ליעדים של הטיול. נסו שוב מאוחר יותר.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {withData.map((city) => (
        <div
          key={city.city}
          className={`flex flex-col gap-2 ${cityToneClass(tones, city.city)}`}
        >
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-tone-dot" />
            {city.city}
          </h3>
          {/* Days scroll sideways rather than wrapping, so a two-week trip
              stays one row per city instead of a grid that hides the shape. */}
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {city.days.map((day) => {
              const { emoji, label } = describeWeather(day.code);
              return (
                <li key={day.date} className="shrink-0">
                  <Card className="flex w-24 flex-col items-center gap-1 p-3 text-center">
                    <span className="text-xs text-muted">
                      {weekdayLabel(day.date)}
                    </span>
                    <span className="text-2xl" title={label} aria-label={label}>
                      {emoji}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {Math.round(day.maxC)}° / {Math.round(day.minC)}°
                    </span>
                    {day.rainChance !== null && day.rainChance > 0 && (
                      <span className="text-xs text-muted tabular-nums">
                        💧 {day.rainChance}%
                      </span>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
