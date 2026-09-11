import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { getExchangeRate } from "@/lib/currency";
import { getDailyForecast } from "@/lib/weather";
import { destinationCurrency, HOME_CURRENCY } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { expensesForDay } from "../domain/expenses";
import type { DailyExpense } from "../domain/expenses";
import { describeWeather } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import type { NightLodging } from "../domain/trip-days";
import { CurrencyTile } from "./currency-converter";
import { DailyExpensesTile } from "./daily-expenses";
import { DomainIcon } from "./domain-icon";

type Tile = {
  key: string;
  label: string;
  value: string;
  hint: string | null;
  icon: React.ReactNode;
  href: string | null;
};

// The strip of facts under "עכשיו": the weather where you are, what you spent
// today (tap to add or fix), the exchange rate (tap to convert), and where you
// sleep tonight. Two of the four are client tiles with dialogs behind them;
// the data they need is fetched here, once, on the server.
//
// Behind its own Suspense in the page, because it is the one part of the
// screen that goes to the network (forecast, rates).
export async function TodayStats({
  tripId,
  tripName,
  date,
  dayNumber,
  city,
  expenses,
  lodging,
}: {
  tripId: string;
  tripName: string;
  date: string | null;
  dayNumber: number | null;
  city: string | null;
  expenses: DailyExpense[];
  lodging: NightLodging | null;
}) {
  const route = await getTripRoute(tripId, tripName);
  const stop =
    route.stops.find((candidate) => candidate.city === city) ??
    route.stops[0] ??
    null;

  // The trip's money: the currency most of its stops use. The tile prefers the
  // current stop's country when it differs (a day trip across a border).
  const currency =
    destinationCurrency([stop?.countryCode]) ??
    destinationCurrency(route.stops.map((candidate) => candidate.countryCode));

  const [weatherToday, rate] = await Promise.all([
    date && stop
      ? getDailyForecast({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startDate: date,
          endDate: date,
        }).then((days) => days?.find((day) => day.date === date) ?? null)
      : Promise.resolve(null),
    currency
      ? getExchangeRate(HOME_CURRENCY, currency)
      : Promise.resolve<ExchangeRate | null>(null),
  ]);

  let weather: Tile | null = null;
  if (weatherToday) {
    const described = describeWeather(weatherToday.code);
    weather = {
      key: "weather",
      label: described.label,
      value: `${Math.round(weatherToday.maxC)}°`,
      hint:
        weatherToday.rainChance !== null && weatherToday.rainChance > 0
          ? `גשם ${weatherToday.rainChance}%`
          : `מינימום ${Math.round(weatherToday.minC)}°`,
      icon: <DomainIcon name={described.icon} className="h-4 w-4" />,
      href: `/trips/${tripId}/more/trip`,
    };
  }

  const lodgingTile: Tile = {
    key: "lodging",
    label: lodging?.isCheckIn ? "צ׳ק־אין" : "לינה הלילה",
    value: lodging ? lodging.booking.title : "—",
    hint: lodging
      ? lodging.isLastNight
        ? "הלילה האחרון"
        : (lodging.booking.city ?? "")
      : "אין לינה מוזמנת",
    icon: <DomainIcon name="lodging" className="h-4 w-4" />,
    href: `/trips/${tripId}/more/trip`,
  };

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <li className="min-w-0">
        <StatTile
          tile={
            weather ?? {
              key: "weather",
              label: "מזג אוויר",
              value: "—",
              hint: "אין תחזית לתאריך",
              icon: <HelpCircle className="h-4 w-4" aria-hidden="true" />,
              href: null,
            }
          }
        />
      </li>
      <li className="min-w-0">
        <DailyExpensesTile
          tripId={tripId}
          dayNumber={dayNumber ?? 1}
          expenses={dayNumber === null ? [] : expensesForDay(expenses, dayNumber)}
          currency={currency ?? HOME_CURRENCY}
          rate={rate}
        />
      </li>
      <li className="min-w-0">
        <CurrencyTile rate={rate} />
      </li>
      <li className="min-w-0">
        <StatTile tile={lodgingTile} />
      </li>
    </ul>
  );
}

function StatTile({ tile }: { tile: Tile }) {
  const body = (
    <>
      <span className="flex min-w-0 items-center justify-center gap-1 text-caption font-semibold text-muted">
        <span className="shrink-0">{tile.icon}</span>
        <span className="min-w-0 truncate">{tile.label}</span>
      </span>
      <span className="min-w-0 truncate text-sm font-black">{tile.value}</span>
      {tile.hint && (
        <span className="min-w-0 truncate text-caption text-muted">
          {tile.hint}
        </span>
      )}
    </>
  );

  const className =
    "flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card border border-border bg-surface px-2 py-2.5 text-center";

  if (!tile.href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={tile.href}
      className={`${className} transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {body}
    </Link>
  );
}
