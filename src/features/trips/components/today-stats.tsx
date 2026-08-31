import Link from "next/link";
import { HelpCircle, Wallet } from "lucide-react";
import { getDailyForecast } from "@/lib/weather";
import { costTotalsByCurrency, formatMoney } from "../domain/expenses";
import { describeWeather } from "../domain/weather";
import { getTripRoute } from "../infrastructure/route-service";
import type { Booking } from "../domain/booking";
import type { NightLodging } from "../domain/trip-days";
import { DomainIcon } from "./domain-icon";

// Three numbers under the "now" card.
//
// Everything else on this screen is one thing at a time — what you are doing,
// then the day in order. These are the three facts you would otherwise switch
// tabs to check and switch back from: is it going to rain, how much has this
// cost so far, and where am I sleeping. None of them is worth a card; together
// they are worth a row.
//
// Three, not five. The row is 375px wide before anything else, and a fourth
// tile puts each of them under 88px — narrow enough that "8,000 ₪" starts
// ellipsing, which defeats the point of showing a number at all.
//
// A tile with no answer renders as a dash rather than disappearing: a row that
// changes length between days reads as a bug, and "no forecast for this date" is
// itself worth knowing.

type Tile = {
  key: string;
  label: string;
  value: string;
  hint: string | null;
  icon: React.ReactNode;
  href: string | null;
};

export async function TodayStats({
  tripId,
  tripName,
  date,
  city,
  bookings,
  lodging,
}: {
  tripId: string;
  tripName: string;
  // The calendar date of the day being shown, YYYY-MM-DD. Null before the trip
  // starts, and then there is no "today" to describe.
  date: string | null;
  // Which city the day is in, for the forecast. Null falls back to the route's
  // first stop.
  city: string | null;
  // Every booking in the trip — the cost total is trip-to-date, not today's.
  bookings: Booking[];
  lodging: NightLodging | null;
}) {
  const tiles: Tile[] = [];

  // ---- weather ------------------------------------------------------------
  // One city, one day. WeatherPanel fans out a request per city across the
  // whole trip window; this needs a single date, so it asks for one.
  //
  // Coordinates come from the route the map already resolved and cached, so
  // this costs no geocoding — the same reason WeatherPanel reads it.
  let weather: Tile | null = null;
  if (date) {
    const route = await getTripRoute(tripId, tripName);
    const stop =
      route.stops.find((candidate) => candidate.city === city) ??
      route.stops[0] ??
      null;

    if (stop) {
      const days = await getDailyForecast({
        latitude: stop.latitude,
        longitude: stop.longitude,
        startDate: date,
        endDate: date,
      });
      const today = days?.find((day) => day.date === date) ?? null;
      if (today) {
        const described = describeWeather(today.code);
        weather = {
          key: "weather",
          label: described.label,
          value: `${Math.round(today.maxC)}°`,
          hint:
            today.rainChance !== null && today.rainChance > 0
              ? `גשם ${today.rainChance}%`
              : `מינימום ${Math.round(today.minC)}°`,
          icon: <DomainIcon name={described.icon} className="h-4 w-4" />,
          href: `/trips/${tripId}/more/trip`,
        };
      }
    }
  }

  tiles.push(
    weather ?? {
      key: "weather",
      label: "מזג אוויר",
      value: "—",
      hint: "אין תחזית לתאריך",
      icon: <HelpCircle className="h-4 w-4" aria-hidden="true" />,
      href: null,
    },
  );

  // ---- spend --------------------------------------------------------------
  // The largest currency total rather than a sum across currencies: adding
  // shekels to yen would need a rate, and a made-up rate on the fold of the
  // screen someone checks daily is worse than showing one honest number.
  const totals = costTotalsByCurrency(bookings);
  const biggest = totals[0] ?? null;
  tiles.push({
    key: "spend",
    label: "הוצאות",
    value: biggest ? formatMoney(biggest.total, biggest.currency) : "—",
    hint: biggest
      ? totals.length > 1
        ? `ועוד ${totals.length - 1} מטבעות`
        : "עד כה"
      : "עוד לא הוזן",
    icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
    href: `/trips/${tripId}/more/trip`,
  });

  // ---- tonight ------------------------------------------------------------
  tiles.push({
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
  });

  return (
    <ul className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <li key={tile.key} className="min-w-0">
          <StatTile tile={tile} />
        </li>
      ))}
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
      {/* The value is the reason the tile exists, so it is the one thing allowed
          to shrink the label rather than the other way round. truncate and not
          wrap: three tiles in a row have to stay the same height. */}
      <span className="min-w-0 truncate text-sm font-black">{tile.value}</span>
      {tile.hint && (
        <span className="min-w-0 truncate text-caption text-muted">
          {tile.hint}
        </span>
      )}
    </>
  );

  const shared =
    "flex h-full min-w-0 flex-col items-center gap-0.5 rounded-card bg-surface px-2 py-2.5 text-center shadow-soft";

  if (!tile.href) {
    return <div className={shared}>{body}</div>;
  }

  return (
    <Link
      href={tile.href}
      className={`${shared} transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      {body}
    </Link>
  );
}
