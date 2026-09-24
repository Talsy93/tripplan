import { cache } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Banknote, ChevronLeft, Languages, Moon } from "lucide-react";
import { getExchangeRates } from "@/lib/currency";
import { getDailyForecast } from "@/lib/weather";
import { destinationCurrency, HOME_CURRENCY } from "../domain/currency";
import { APP_TIME_ZONE, describeWeather } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import { DomainIcon } from "./domain-icon";
import { weatherToneClass } from "./day-weather-card";

const routeOnce = cache(getTripRoute);

// "<עיר> בקצרה" — the city guide's pane on a desktop (PN21, Pencil
// city-guide-desktop): the weather there today, what the money is worth, how
// long the trip stays, and the phrasebook one press away. Things you glance
// at while reading recommendations, never a second guide.
//
// Only from @4xl; the page draws it inside Suspense, because resolving the
// route can geocode and the recommendations must not wait for it. Every line
// is optional — a city the route could not place simply gets fewer of them.
export async function CityGlance({
  tripId,
  tripName,
  city,
  nights,
}: {
  tripId: string;
  tripName: string;
  city: string;
  nights: number | null;
}) {
  const route = await routeOnce(tripId, tripName);
  const stop = route.stops.find((candidate) => candidate.city === city) ?? null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
  const currency = stop ? destinationCurrency([stop.countryCode]) : null;

  const [forecast, rates] = await Promise.all([
    stop
      ? getDailyForecast({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startDate: today,
          endDate: today,
        })
      : Promise.resolve(null),
    currency && currency !== HOME_CURRENCY
      ? getExchangeRates(HOME_CURRENCY, [currency])
      : Promise.resolve([]),
  ]);

  const weather = forecast?.[0] ?? null;
  const described = weather ? describeWeather(weather.code) : null;
  const rate = rates.find((entry) => entry.quote === currency) ?? null;

  const rows: { Icon: LucideIcon; title: string; detail: string }[] = [];
  if (nights !== null) {
    rows.push({
      Icon: Moon,
      title: nights === 1 ? "לילה אחד" : `${nights} לילות`,
      detail: "כמה זמן הטיול כאן",
    });
  }
  if (currency && rate) {
    rows.push({
      Icon: Banknote,
      title: currency,
      detail: `1 ${currency} ≈ ${(1 / rate.rate).toFixed(2)} ₪`,
    });
  }

  return (
    <div className="hidden flex-col gap-4 @4xl:flex">
      <h2 className="text-lg font-bold leading-6">{city} בקצרה</h2>

      {weather && described && (
        <div className="flex items-center gap-3 rounded-[18px] bg-surface p-4 shadow-card">
          <span className={weatherToneClass(described.icon)} aria-hidden="true">
            <DomainIcon name={described.icon} className="h-8 w-8" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xl font-bold tabular-nums">
              {Math.round(weather.maxC)}° · {described.label}
            </span>
            <span className="text-caption text-muted">
              היום ב{city}
              {weather.rainChance !== null ? ` · גשם ${weather.rainChance}%` : ""}
            </span>
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col rounded-[18px] bg-surface px-4 shadow-card">
          {rows.map(({ Icon, title, detail }) => (
            <li
              key={title}
              className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cat-mustsee-tint text-cat-mustsee-ink"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold" dir="auto">
                  {title}
                </span>
                <span className="text-caption text-muted" dir="auto">
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/trips/${tripId}/more/phrases`}
        className="flex min-h-14 items-center gap-3 rounded-[18px] bg-surface px-4 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-[15px] font-medium">מילים שימושיות</span>
        <ChevronLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>
    </div>
  );
}
