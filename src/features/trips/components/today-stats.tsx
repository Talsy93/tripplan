import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { getExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { getDailyForecast } from "@/lib/weather";
import {
  destinationCurrency,
  HOME_CURRENCY,
  tripCurrencies,
} from "../domain/currency";
import { expensesForDay } from "../domain/expenses";
import type { DailyExpense } from "../domain/expenses";
import { describeWeather } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import type { NightLodging } from "../domain/trip-days";
import { CurrencyTile } from "./currency-converter";
import { DailyExpensesTile } from "./daily-expenses";
import { DomainIcon } from "./domain-icon";
import { toolTileClasses, ToolTileBody } from "./tool-tile";

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

  // Every currency the trip touches, and the one for today: the current stop's
  // country, falling back to the trip's most-used. A trip across a border gets
  // a chooser in the money tile; a one-country trip never sees it.
  const currencies = tripCurrencies(
    route.stops.map((candidate) => candidate.countryCode),
  );
  const currency = destinationCurrency([stop?.countryCode]) ?? currencies[0] ?? null;

  const [weatherToday, rates] = await Promise.all([
    date && stop
      ? getDailyForecast({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startDate: date,
          endDate: date,
        }).then((days) => days?.find((day) => day.date === date) ?? null)
      : Promise.resolve(null),
    getExchangeRates(HOME_CURRENCY, currencies),
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
      // The forecast lives on "לפני היציאה" since the details page went.
      href: `/trips/${tripId}/more/gear`,
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
    href: `/trips/${tripId}/more`,
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          rates={rates}
          city={city}
        />
      </li>
      <li className="min-w-0">
        <CurrencyTile rates={rates} initialQuote={currency} />
      </li>
      <li className="min-w-0">
        <StatTile tile={lodgingTile} />
      </li>
    </ul>
  );
}

// The same tile as the toolbox's (Pencil, v7): an icon on a teal tile, the
// value, and what it is — so the strip and the toolbox read as one set.
function StatTile({ tile }: { tile: Tile }) {
  const body = (
    <ToolTileBody
      icon={tile.icon}
      value={tile.value}
      label={tile.hint ? `${tile.label} · ${tile.hint}` : tile.label}
    />
  );

  if (!tile.href) {
    return <div className={cn(toolTileClasses, "hover:shadow-card")}>{body}</div>;
  }

  return (
    <Link href={tile.href} className={toolTileClasses}>
      {body}
    </Link>
  );
}
