import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Compass, Eye, Lock } from "lucide-react";
import { PageEnter } from "@/components/layout";
import { cn } from "@/lib/cn";
import { formatInZone } from "@/lib/datetime";
import {
  APP_TIME_ZONE,
  BOOKING_KINDS,
  dateOfDay,
  dayLabel,
  DomainIcon,
  formatShortDate,
  getSharedTrip,
  stopsByCountry,
} from "@/features/trips";

// Read-only, and public. No session, no navigation into the app, nothing
// clickable that could change anything — see infrastructure/share-service.ts
// for what is deliberately absent from the data itself.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getSharedTrip(token);

  return {
    title: trip ? `${trip.name} · MyTrip` : "טיול לא נמצא · MyTrip",
    // A shared itinerary should not turn up in a search engine. The token is
    // the only thing protecting it, and an indexed page hands it to everyone.
    robots: { index: false, follow: false },
  };
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getSharedTrip(token);

  // A revoked link and a malformed one both land here, and deliberately look
  // identical: distinguishing them would confirm that a token was once valid.
  if (!trip) notFound();

  const countryGroups = stopsByCountry(trip.stops);
  const showCountries = countryGroups.length > 1;

  // Laid out as design/pencil/exports/public-share-mobile: the "view only"
  // pill, the title and dates, a tile per city with its nights, the bookings
  // as rows in one card, and a card per day. The export's travellers line is
  // not drawn — the shared view carries no names, on purpose.
  return (
    <main className="flex min-h-dvh flex-col">
      <PageEnter className="mx-auto max-w-3xl flex-1 gap-6 px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[image:var(--hero-gradient)] text-white"
              >
                <Compass className="h-4 w-4" />
              </span>
              MyTrip
            </Link>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-caption font-semibold text-muted">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              לצפייה בלבד
            </span>
          </div>
          <h1 className="text-[28px] font-bold leading-tight wrap-anywhere">
            {trip.name}
          </h1>
          {trip.startDate && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatShortDate(trip.startDate)}
              {trip.endDate && ` – ${formatShortDate(trip.endDate)}`}
            </p>
          )}
        </div>

        {trip.stops.length > 0 && (
          <section aria-label="התחנות" className="flex flex-col gap-3">
            {countryGroups.map((group, groupIndex) => (
              <div
                key={`${group.country ?? "unknown"}-${groupIndex}`}
                className="flex flex-col gap-2"
              >
                {showCountries && (
                  <h2 className="text-caption font-bold text-muted">
                    {group.country ?? "יעדים נוספים"}
                  </h2>
                )}
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {group.stops.map((stop, index) => (
                    <li
                      key={stop.city}
                      className={cn(
                        "flex min-w-0 flex-col gap-1 rounded-[18px] bg-surface p-3.5 shadow-card",
                        TONES[index % TONES.length],
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full bg-tone-dot"
                      />
                      <span className="truncate text-base font-bold">
                        {stop.city}
                      </span>
                      <span className="text-caption text-muted">
                        {stop.nights === 0
                          ? "בלי לינה"
                          : stop.nights === 1
                            ? "לילה אחד"
                            : `${stop.nights} לילות`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {trip.bookings.length > 0 && (
          <section aria-label="טיסות ולינה">
            <ul className="flex flex-col divide-y divide-border rounded-[20px] bg-surface px-4 shadow-card">
              {trip.bookings.map((booking) => {
                const kind = BOOKING_KINDS[booking.kind];
                const where = kind.isTransport
                  ? [booking.origin, booking.destination]
                      .filter(Boolean)
                      .join(" → ")
                  : booking.city;

                return (
                  <li
                    key={booking.id}
                    className="flex min-w-0 items-start gap-3 py-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-tint text-primary"
                    >
                      <DomainIcon name={kind.icon} className="h-5 w-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-bold wrap-anywhere">
                        {booking.title}
                      </span>
                      {where && (
                        <span className="text-caption text-muted">{where}</span>
                      )}
                      <span
                        dir="ltr"
                        className="self-end text-caption tabular-nums text-muted"
                      >
                        {formatMoment(booking.starts_at)}
                        {booking.ends_at &&
                          ` → ${formatMoment(booking.ends_at)}`}
                      </span>
                      {booking.note && (
                        <span className="text-caption text-muted">
                          {booking.note}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {trip.itinerary.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">לוח הזמנים</h2>
            {trip.itinerary.map((day) => {
              const city = [...day.items].reverse().find((it) => it.city)?.city;
              return (
                <article
                  key={day.day}
                  className="flex flex-col gap-2 rounded-[18px] bg-surface p-4 shadow-card"
                >
                  <h3 className="text-base font-bold">
                    {dayLabel(day.day, dateOfDay(trip.startDate, day.day))}
                    {city && <span> · {city}</span>}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {day.items.map((item) => (
                      <li key={item.id} className="flex flex-col gap-0.5">
                        <span className="flex items-baseline gap-2 text-sm">
                          <span className="w-11 shrink-0 tabular-nums text-outline">
                            {item.startLabel}
                          </span>
                          <span className="min-w-0 text-muted-strong">
                            {item.title}
                          </span>
                        </span>
                        {item.note && (
                          <span className="ps-13 text-caption text-muted">
                            {item.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </section>
        )}

        {/* True of what this page is given: redactBooking (domain/share.ts)
            drops confirmation numbers, addresses and prices before the data
            reaches it. */}
        <footer className="mt-auto flex flex-col items-center gap-1 pt-2 text-center text-caption text-outline">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            בלי מספרי אישור, כתובות מדויקות ומחירים
          </span>
          <span>
            נבנה ב-
            <Link href="/" className="font-semibold text-primary hover:underline">
              MyTrip
            </Link>
          </span>
        </footer>
      </PageEnter>
    </main>
  );
}

// The city tiles' dots, by position — the tone palette the app gives cities
// everywhere else, so two neighbouring stops never share a colour.
const TONES = [
  "tone-peach",
  "tone-mint",
  "tone-sky",
  "tone-rose",
  "tone-amber",
  "tone-lilac",
];

// Rendered on the server for a reader whose timezone we do not know, so the
// trip's own zone is used rather than the machine's. A shared plan says when
// things happen *there*.
//
// This forced UTC until bookings started storing real instants, which was only
// right while the write side stored the typed digits as though they were UTC.
// APP_TIME_ZONE is the same zone the owner sees, so the shared page and the
// trip now agree — they did not before.
function formatMoment(value: string) {
  return formatInZone(value, APP_TIME_ZONE);
}
