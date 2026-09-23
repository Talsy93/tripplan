import { cache } from "react";
import Link from "next/link";
import {
  BedDouble,
  FileText,
  MapPin,
  Moon,
  Share2,
  Sun,
  Sunrise,
  Sunset,
  Users,
  Wrench,
} from "lucide-react";
import { getExchangeRates } from "@/lib/currency";
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
import { describeWeather } from "../domain/weather";
import { getPhrasebook } from "../infrastructure/phrasebook-service";
import { getTripRoute } from "../infrastructure/route-service";
import { CurrencyCard } from "./currency-converter";
import { DailyExpensesCard } from "./daily-expenses";
import { DomainIcon } from "./domain-icon";
import { PhraseCard } from "./phrase-card";

// The היום tab in the Stitch design's order (v6): a greeting with the weather,
// then — after the now/next cards — where you sleep, a toolbox of the three
// things a day on the road asks for, and who is on the trip with you.

// One route per request, whichever section asks first. Resolving it is the
// most expensive read on this screen, and two sections need it.
const routeOnce = cache(getTripRoute);

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "בוקר טוב", Icon: Sunrise };
  if (hour >= 12 && hour < 17) return { text: "צהריים טובים", Icon: Sun };
  if (hour >= 17 && hour < 21) return { text: "ערב טוב", Icon: Sunset };
  return { text: "לילה טוב", Icon: Moon };
}

// "בוקר טוב, עומר!", the weather as a terracotta line above it, the date as a
// pill, and how many stops the day holds.
export async function TodayGreeting({
  tripId,
  tripName,
  date,
  city,
  firstName,
  stopCount,
  hour,
}: {
  tripId: string;
  tripName: string;
  date: string | null;
  city: string | null;
  firstName: string | null;
  stopCount: number;
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
  const greeting = greetingFor(hour);

  const dateLabel = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : null;

  return (
    <section className="flex min-w-0 flex-col gap-1 pb-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        {weather && described ? (
          <span className="flex min-w-0 items-center gap-1">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta-bright text-cta-deep" aria-hidden="true">
              <DomainIcon name={described.icon} className="h-[0.9375rem] w-[0.9375rem]" />
            </span>
            <span className="truncate text-xs font-semibold text-cta-strong">
              {Math.round(weather.maxC)}°C {described.label}
            </span>
          </span>
        ) : (
          <span />
        )}
        {dateLabel && (
          <span className="shrink-0 rounded-full bg-surface-high px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
            {dateLabel}
          </span>
        )}
      </div>
      <h2 className="flex items-center gap-2 text-[1.75rem] leading-9 font-bold tracking-[-0.01em] text-foreground">
        {greeting.text}
        {firstName ? `, ${firstName}!` : "!"}
        <greeting.Icon className="h-7 w-7 text-cta-bright" aria-hidden="true" />
      </h2>
      <p className="text-sm text-muted">
        {stopCount === 0
          ? `היום פנוי${city ? ` ב${city}` : ""}.`
          : `היום מחכים לך ${stopCount === 1 ? "יעד אחד מתוכנן" : `${stopCount} יעדים מתוכננים`}${city ? ` ב${city}` : ""}.`}
      </p>
    </section>
  );
}

// "איפה ישנים הלילה?" — the night's lodging: the status line, the name, the
// address, the booking code in its own box, and two actions.
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

  return (
    <section aria-label="איפה ישנים הלילה" className="flex min-w-0 flex-col gap-1">
      <h3 className="flex items-center gap-1 text-lg leading-6 font-semibold text-foreground">
        <BedDouble className="h-5 w-5 text-primary" aria-hidden="true" />
        איפה ישנים הלילה?
      </h3>
      <div className="flex min-w-0 flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 text-[0.625rem] leading-[0.875rem] font-semibold text-cta-strong">
              <DomainIcon name="lodging" className="h-4 w-4" />
              {stay.isCheckIn ? "צ׳ק-אין היום" : stay.isLastNight ? "הלילה האחרון" : "הלינה של הלילה"}
            </span>
            <h4 className="mt-0.5 text-base leading-[1.375rem] font-bold text-foreground wrap-anywhere">
              {booking.title}
            </h4>
            {(booking.address || booking.city) && (
              <p className="mt-0.5 flex items-center gap-0.5 text-xs text-muted">
                <MapPin className="h-[0.9375rem] w-[0.9375rem] shrink-0" aria-hidden="true" />
                <span className="min-w-0 wrap-anywhere">{booking.address ?? booking.city}</span>
              </p>
            )}
          </div>
          {booking.confirmation && (
            <div className="shrink-0 rounded-lg bg-surface-high px-2 py-1 text-center">
              <span className="block text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
                קוד הזמנה
              </span>
              <span className="font-mono text-xs font-bold text-primary" dir="ltr">
                {booking.confirmation}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/trips/${tripId}/more`}
            className="flex min-h-[2.625rem] flex-1 items-center justify-center gap-1 rounded-lg bg-surface-sunken text-xs font-semibold text-primary transition-colors hover:bg-surface-high"
          >
            <FileText className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            פרטי ההזמנה
          </Link>
          <a
            href={googleMapsSearchUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[2.625rem] flex-1 items-center justify-center gap-1 rounded-lg bg-surface-sunken text-xs font-semibold text-primary transition-colors hover:bg-surface-high"
          >
            <MapPin className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            פתח במפה
          </a>
        </div>
      </div>
    </section>
  );
}

// "ארגז כלים מהירים לדרך": the currency converter, the phrasebook and today's
// spending. Rates are cached for the day by lib/currency, the phrasebook is
// already stored — nothing here calls the AI.
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
    <section aria-label="ארגז כלים" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-lg leading-6 font-semibold text-foreground">
          <Wrench className="h-5 w-5 text-cta-strong" aria-hidden="true" />
          ארגז כלים מהירים לדרך
        </h3>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <CurrencyCard rates={rates} initialQuote={currency} />
        <PhraseCard tripId={tripId} phrasebook={phrasebook} />
        <DailyExpensesCard
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
// names, and a round share button.
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
      className="flex min-w-0 flex-col gap-4 rounded-card bg-surface-sunken p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-lg leading-6 font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          שותפים למסע
        </h3>
        {members.length > 1 && (
          <span className="flex items-center gap-1 text-[0.625rem] leading-[0.875rem] font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            משותף עם {members.length - 1}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
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
            <span className="truncate text-xs font-semibold text-foreground">
              {names.join(", ")}
            </span>
            <span className="text-[0.625rem] leading-[0.875rem] text-muted">
              {members.length > 1 ? "כולם רואים את אותו לו״ז" : "הזמינו מישהו להצטרף"}
            </span>
          </div>
        </div>
        <Link
          href={`/trips/${tripId}/more/share`}
          aria-label="שיתוף הטיול"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-sm transition-colors hover:bg-surface-high"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
