// Daily forecasts from Open-Meteo — free, no API key, no billing (project
// rule: paid services are off-limits).
//
// The 16-day horizon is enforced by the caller, not discovered here: asking
// beyond it returns HTTP 400 with {"error":true,...}, so a trip further out is
// filtered before any request is made rather than after one fails.

import type { DailyWeather } from "@/features/trips/domain/weather";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export async function getDailyForecast({
  latitude,
  longitude,
  startDate,
  endDate,
}: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}): Promise<DailyWeather[] | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    // Dates come back in the destination's own timezone, which is the one the
    // traveller will be standing in.
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      // Forecasts are revised through the day; an hour is fresh enough and
      // keeps repeat page views off the service.
      next: { revalidate: 3_600 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      error?: boolean;
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
      };
    };
    if (json.error || !json.daily?.time) return null;

    const {
      time,
      weather_code = [],
      temperature_2m_max = [],
      temperature_2m_min = [],
      precipitation_probability_max = [],
    } = json.daily;

    const days: DailyWeather[] = [];
    for (const [index, date] of time.entries()) {
      const maxC = temperature_2m_max[index];
      const minC = temperature_2m_min[index];
      // A day missing its temperatures is not worth a card.
      if (typeof maxC !== "number" || typeof minC !== "number") continue;

      days.push({
        date,
        code: weather_code[index] ?? 0,
        maxC,
        minC,
        rainChance: precipitation_probability_max[index] ?? null,
      });
    }
    return days;
  } catch {
    return null;
  }
}
