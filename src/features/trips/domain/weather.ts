// Weather for the trip's cities.
//
// Open-Meteo forecasts 16 days ahead and no further — asking for more is an
// HTTP 400, not an empty answer. A trip booked for next spring simply has no
// forecast, and the honest thing is to say when one will exist rather than
// render an empty panel that looks broken.

export type DailyWeather = {
  // ISO date, "2026-08-12".
  date: string;
  code: number;
  maxC: number;
  minC: number;
  rainChance: number | null;
};

export type CityWeather = {
  city: string;
  days: DailyWeather[];
};

// How far ahead Open-Meteo will forecast, counting today as day one.
export const MAX_FORECAST_DAYS = 16;

// What the panel should do, worked out before any network call.
export type ForecastWindow =
  | { kind: "available"; startDate: string; endDate: string }
  // The trip is real but too far off for any forecast to exist yet.
  | { kind: "too-far"; daysUntilAvailable: number }
  | { kind: "past" };

// Decides which dates can actually be forecast.
//
// `today` is passed in rather than read from the clock so this stays pure.
// With no trip dates we show the days ahead anyway — someone still planning
// wants to know what the place is like right now.
export function forecastWindow(
  tripStart: string | null,
  tripEnd: string | null,
  today: string,
): ForecastWindow {
  const lastForecastable = addDays(today, MAX_FORECAST_DAYS - 1);

  if (!tripStart) {
    return {
      kind: "available",
      startDate: today,
      endDate: addDays(today, 6),
    };
  }

  const end = tripEnd ?? tripStart;
  if (end < today) return { kind: "past" };

  if (tripStart > lastForecastable) {
    return {
      kind: "too-far",
      daysUntilAvailable: daysBetween(lastForecastable, tripStart),
    };
  }

  // The trip may start before the forecast runs out but end after it.
  return {
    kind: "available",
    startDate: tripStart > today ? tripStart : today,
    endDate: end < lastForecastable ? end : lastForecastable,
  };
}

// ---- WMO weather codes ----------------------------------------------------
// Open-Meteo reports conditions as WMO codes. Grouped rather than enumerated:
// the difference between "light drizzle" and "moderate drizzle" is not
// something a traveller packs differently for.
// Reference: https://open-meteo.com/en/docs

const WEATHER_CODES: { max: number; emoji: string; label: string }[] = [
  { max: 0, emoji: "☀️", label: "בהיר" },
  { max: 3, emoji: "⛅", label: "מעונן חלקית" },
  { max: 48, emoji: "🌫️", label: "ערפל" },
  { max: 57, emoji: "🌦️", label: "טפטוף" },
  { max: 67, emoji: "🌧️", label: "גשם" },
  { max: 77, emoji: "❄️", label: "שלג" },
  { max: 82, emoji: "🌧️", label: "ממטרים" },
  { max: 86, emoji: "🌨️", label: "ממטרי שלג" },
  { max: 99, emoji: "⛈️", label: "סופת רעמים" },
];

export function describeWeather(code: number) {
  return (
    WEATHER_CODES.find((entry) => code <= entry.max) ?? {
      emoji: "🌡️",
      label: "לא ידוע",
    }
  );
}

// ---- Date helpers ---------------------------------------------------------
// ISO date strings throughout. Dates here are calendar days, not moments, so
// treating them as text avoids dragging timezones into a question that has
// nothing to do with them.

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function todayIso(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function weekdayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
