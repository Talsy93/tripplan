import { Badge, Card, EmptyState } from "@/components/ui";
import { BOOKING_KINDS, bookingAlert, bookingWhere } from "../domain/booking";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { Booking } from "../domain/booking";

const MAX_SHOWN = 3;

// The next few things that actually happen at a time — flights, trains,
// check-ins. Everything else in the app is a plan; these have clocks.
//
// `now` is stamped by the server and passed in, the same way BookingList does
// it, so the relative wording cannot disagree between the server render and
// hydration.
export function UpNext({
  bookings,
  now,
  cities = [],
}: {
  bookings: Booking[];
  now: string;
  cities?: string[];
}) {
  const at = new Date(now);
  const upcoming = bookings
    .filter((b) => new Date(b.starts_at).getTime() >= at.getTime())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, MAX_SHOWN);

  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon="🧭"
        title="אין עדיין מה לתזמן"
        description="טיסות, רכבות ולינה שתוסיפו בטאב ״עוד״ יופיעו כאן לפי הסדר."
      />
    );
  }

  const tones = cityToneMap(cities);

  return (
    <ul className="flex flex-col gap-3">
      {upcoming.map((booking) => {
        const kind = BOOKING_KINDS[booking.kind];
        const alert = bookingAlert(booking, at);
        const where = bookingWhere(booking);

        return (
          <li key={booking.id} className={cityToneClass(tones, booking.city)}>
            <Card className="flex items-center gap-3 border-s-4 border-s-tone-dot p-3">
              <span className="text-2xl leading-none" aria-hidden="true">
                {kind.emoji}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{booking.title}</span>
                {where && (
                  <span className="truncate text-xs text-muted">{where}</span>
                )}
              </div>
              {alert && (
                <Badge
                  tone={alert.urgency === "now" ? "warning" : "neutral"}
                  className="shrink-0"
                >
                  {alert.message}
                </Badge>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
