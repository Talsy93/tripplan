import { cache } from "react";
import Link from "next/link";
import { BedDouble, ChevronLeft, MapPin, Share2 } from "lucide-react";
import { getExchangeRates } from "@/lib/currency";
import { instantToWallClock } from "@/lib/datetime";
import { googleMapsSearchUrl } from "@/lib/maps";
import { getDailyForecast } from "@/lib/weather";
import {
  destinationCurrency,
  HOME_CURRENCY,
  tripCurrencies,
} from "../domain/currency";
import { expensesForDay } from "../domain/expenses";
import type { DailyExpense } from "../domain/expenses";
import type { TripMember } from "../domain/membership";
import type { NightLodging } from "../domain/trip-days";
import { APP_TIME_ZONE, describeWeather } from "../domain/weather";
import { getPhrasebook } from "../infrastructure/phrasebook-service";
import { getTripRoute } from "../infrastructure/route-service";
import { CurrencyTile } from "./currency-converter";
import { DailyExpensesTile } from "./daily-expenses";
import { weatherToneClass } from "./day-weather-card";
import { DomainIcon } from "./domain-icon";
import { PhraseTile } from "./phrase-card";

// The היום tab in the Pencil design's order (v7): a greeting with the weather
// chip beside it, then — after the "now" card — where you sleep, a toolbox of
// the three things a day on the road asks for, and who is on the trip with you.

// One route per request, whichever section asks first. Resolving it is the
// most expensive read on this screen, and two sections need it.
const routeOnce = cache(getTripRoute);

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 21) return "ערב טוב";
  return "לילה טוב";
}

// "יום שלישי · יום 3 ברומא" over "בוקר טוב, טל", and a white chip at the other
// end with the day's high, the chance of rain and the sky as an icon.
export async function TodayGreeting({
  tripId,
  tripName,
  date,
  city,
  firstName,
  dayNumber = null,
  hour,
}: {
  tripId: string;
  tripName: string;
  date: string | null;
  city: string | null;
  firstName: string | null;
  // Which day of the trip this is, for "יום 3 ברומא".
  dayNumber?: number | null;
  // How many stops the day holds. The Pencil greeting does not say it — the
  // day's schedule at the foot of the screen does — so it is not drawn.
  stopCount?: number;
  // The wall-clock hour where the trip is, from the server's "now".
  hour: number;
}) {
  const route = await routeOnce(tripId, tripName);
  const stop =
    route.stops.find((candidate) => candidate.city === city) ??
    route.stops[0] ??
    null;
  const weather =
    date && stop
      ? await getDailyForecast({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startDate: date,
          endDate: date,
        }).then((days) => days?.find((day) => day.date === date) ?? null)
      : null;
  const described = weather ? describeWeather(weather.code) : null;

  const weekday = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("he-IL", {
        weekday: "long",
        timeZone: "UTC",
      })
    : null;
  const where = [
    dayNumber !== null ? `יום ${dayNumber}` : null,
    city ? `${dayNumber !== null ? "ב" : ""}${city}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const dateLine = [weekday, where].filter(Boolean).join(" · ");

  return (
    <section className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {dateLine && <p className="truncate text-sm text-muted">{dateLine}</p>}
        <h2 className="text-[1.75rem] leading-9 font-bold text-foreground wrap-anywhere">
          {greetingFor(hour)}
          {firstName ? `, ${firstName}` : ""}
        </h2>
      </div>

      {weather && described && (
        <div
          className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-2.5 shadow-card"
          title={described.label}
        >
          <span className={weatherToneClass(described.icon)} aria-hidden="true">
            <DomainIcon name={described.icon} className="h-7 w-7" />
          </span>
          <span className="flex flex-col items-center">
            <span className="text-xl leading-6 font-bold tabular-nums text-foreground">
              {Math.round(weather.maxC)}°
            </span>
            <span className="text-[0.6875rem] leading-4 text-muted">
              {weather.rainChance !== null
                ? `גשם ${weather.rainChance}%`
                : described.label}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

// The night's lodging as one teal-tint row (Pencil, v7): a bed on a white
// tile, the hotel's name, the night's status with the check-in hour, and a
// chevron — the whole row goes to the booking's details. The map is its own
// round button, and the confirmation code rides on the second line.
export function TonightCard({
  tripId,
  stay,
}: {
  tripId: string;
  stay: NightLodging | null;
}) {
  if (!stay) return null;
  const { booking } = stay;
  const place = booking.address ?? [booking.title, booking.city].filter(Boolean).join(" ");

  const checkIn = stay.isCheckIn
    ? instantToWallClock(booking.starts_at, APP_TIME_ZONE).slice(11, 16)
    : null;
  const status = stay.isCheckIn
    ? `לינה הלילה · צ׳ק-אין ${checkIn}`
    : stay.isLastNight
      ? "הלילה האחרון"
      : "לינה הלילה";

  return (
    <section
      aria-label="איפה ישנים הלילה"
      className="relative flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-primary-tint p-4"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-primary"
      >
        <BedDouble className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The stretched link: its ::after covers the row, so the whole row
            is the tap target without wrapping the map button inside a link. */}
        <Link
          href={`/trips/${tripId}/more`}
          className="truncate text-base leading-6 font-bold text-foreground after:absolute after:inset-0 after:rounded-[1.25rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {booking.title}
        </Link>
        <span className="truncate text-xs text-muted">{status}</span>
        {(booking.address || booking.confirmation) && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            {booking.address && <span className="min-w-0 truncate">{booking.address}</span>}
            {booking.address && booking.confirmation && <span aria-hidden="true">·</span>}
            {booking.confirmation && (
              <span className="shrink-0">
                קוד{" "}
                <span dir="ltr" className="font-mono font-semibold text-primary">
                  {booking.confirmation}
                </span>
              </span>
            )}
          </span>
        )}
      </div>
      <a
        href={googleMapsSearchUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${booking.title} במפה`}
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapPin className="h-5 w-5" aria-hidden="true" />
      </a>
      <ChevronLeft className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    </section>
  );
}

// "ארגז כלים": three equal tiles — the exchange rate, a phrase in the local
// language, and today's spending — each opening its own sheet. Rates are
// cached for the day by lib/currency, the phrasebook is already stored —
// nothing here calls the AI.
export async function TodayToolbox({
  tripId,
  tripName,
  city,
  dayNumber,
  expenses,
}: {
  tripId: string;
  tripName: string;
  city: string | null;
  dayNumber: number;
  expenses: DailyExpense[];
}) {
  const route = await routeOnce(tripId, tripName);
  const stop =
    route.stops.find((candidate) => candidate.city === city) ??
    route.stops[0] ??
    null;
  const currencies = tripCurrencies(route.stops.map((candidate) => candidate.countryCode));
  const currency = destinationCurrency([stop?.countryCode]) ?? currencies[0] ?? null;

  const [rates, phrasebook] = await Promise.all([
    getExchangeRates(HOME_CURRENCY, currencies),
    getPhrasebook(tripId),
  ]);

  return (
    <section aria-labelledby="today-toolbox" className="flex min-w-0 flex-col gap-3">
      <h3 id="today-toolbox" className="text-lg leading-6 font-bold text-foreground">
        ארגז כלים
      </h3>
      <div className="grid min-w-0 grid-cols-3 gap-3">
        <CurrencyTile rates={rates} initialQuote={currency} />
        <PhraseTile tripId={tripId} phrasebook={phrasebook} />
        <DailyExpensesTile
          tripId={tripId}
          dayNumber={dayNumber}
          expenses={expensesForDay(expenses, dayNumber)}
          currency={currency ?? HOME_CURRENCY}
          rates={rates}
          city={city}
        />
      </div>
    </section>
  );
}

const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-cta-strong text-white",
  "bg-success text-white",
];

// "שותפים למסע": who is on the trip, as initials in overlapping discs, their
// names, and a round share button — one white card, the same as the rest of
// the screen.
export function PartnersCard({
  tripId,
  members,
}: {
  tripId: string;
  members: TripMember[];
}) {
  const names = members.map(
    (member) => member.member_name ?? member.member_email?.split("@")[0] ?? "?",
  );

  return (
    <section
      aria-label="שותפים למסע"
      className="flex min-w-0 flex-col gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base leading-6 font-bold text-foreground">שותפים למסע</h3>
        {members.length > 1 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-success-ink">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            משותף עם {members.length - 1}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex -space-x-2 space-x-reverse">
            {names.slice(0, 3).map((name, index) => (
              <span
                key={index}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface text-sm font-bold ${AVATAR_TONES[index]}`}
                aria-hidden="true"
              >
                {name.trim()[0]}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {names.join(", ")}
            </span>
            <span className="text-xs text-muted">
              {members.length > 1 ? "כולם רואים את אותו לו״ז" : "הזמינו מישהו להצטרף"}
            </span>
          </div>
        </div>
        <Link
          href={`/trips/${tripId}/more/share`}
          aria-label="שיתוף הטיול"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
