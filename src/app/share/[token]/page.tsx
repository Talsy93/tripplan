import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MapPin, Plane } from "lucide-react";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { formatInZone } from "@/lib/datetime";
import {
  APP_TIME_ZONE,
  BOOKING_KINDS,
  dateOfDay,
  dayLabel,
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

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-6 lg:px-8">
        <span className="flex items-center gap-1.5 font-bold text-brand">
          <Plane className="h-5 w-5" aria-hidden="true" />
          MyTrip
        </span>
        <Badge tone="neutral" className="ms-auto">
          לצפייה בלבד
        </Badge>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 md:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display font-bold">{trip.name}</h1>
          {trip.startDate && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatShortDate(trip.startDate)}
              {trip.endDate && ` – ${formatShortDate(trip.endDate)}`}
            </p>
          )}
        </div>

        {trip.stops.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading level="section">התחנות</SectionHeading>
            <div className="flex flex-col gap-3">
              {countryGroups.map((group, index) => (
                <div
                  key={`${group.country ?? "unknown"}-${index}`}
                  className="flex flex-col gap-2"
                >
                  {showCountries && (
                    <h3 className="text-caption font-bold text-muted">
                      {group.country ?? "יעדים נוספים"}
                    </h3>
                  )}
                  <ul className="flex flex-wrap gap-2">
                    {group.stops.map((stop) => (
                      <li key={stop.city}>
                        <Badge tone="action">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {stop.city}
                          {stop.nights > 0 && (
                            <span className="font-normal">
                              {" · "}
                              {stop.nights === 1
                                ? "לילה"
                                : `${stop.nights} לילות`}
                            </span>
                          )}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {trip.bookings.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading level="section">טיסות ולינה</SectionHeading>
            <ul className="flex flex-col gap-2">
              {trip.bookings.map((booking) => {
                const kind = BOOKING_KINDS[booking.kind];
                const where = kind.isTransport
                  ? [booking.origin, booking.destination]
                      .filter(Boolean)
                      .join(" → ")
                  : booking.city;

                return (
                  <li key={booking.id}>
                    <Card className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span aria-hidden="true">{kind.emoji}</span>
                        {booking.title}
                      </span>
                      {where && (
                        <span className="text-sm text-muted">{where}</span>
                      )}
                      <span
                        dir="ltr"
                        className="text-caption tabular-nums text-muted"
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
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {trip.itinerary.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeading level="section">לוח הזמנים</SectionHeading>
            {trip.itinerary.map((day) => {
              const city = [...day.items].reverse().find((it) => it.city)?.city;
              return (
                <div key={day.day} className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold">
                    {dayLabel(day.day, dateOfDay(trip.startDate, day.day))}
                    {city && (
                      <span className="font-normal text-muted"> · {city}</span>
                    )}
                  </h3>
                  <ul className="flex flex-col gap-2 border-s border-border ps-3">
                    {day.items.map((item) => (
                      <li key={item.id} className="flex flex-col gap-0.5">
                        <span className="flex items-baseline gap-2 text-sm">
                          <span className="shrink-0 tabular-nums text-muted">
                            {item.startLabel}
                          </span>
                          <span className="font-medium">{item.title}</span>
                        </span>
                        {item.note && (
                          <span className="text-caption text-muted">
                            {item.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        )}

        <footer className="mt-auto border-t border-border pt-4 text-caption text-muted">
          נבנה ב-
          <Link href="/" className="font-semibold underline">
            MyTrip
          </Link>
        </footer>
      </div>
    </main>
  );
}

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
