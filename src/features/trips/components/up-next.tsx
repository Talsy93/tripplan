import { Badge, Card, EmptyState } from "@/components/ui";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingTodoAlert,
  bookingWhere,
  cancellationAlert,
} from "../domain/booking";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { Booking, BookingAlert } from "../domain/booking";

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

  // Things to *do* before the trip, as opposed to things that happen during it.
  // Kept above the timeline and not capped: a cancellation deadline you miss
  // costs money, and it is the one item here that is genuinely urgent.
  //
  // These are surfaced even when the trip has no upcoming bookings at all —
  // deciding between two hotels happens long before anything is "up next".
  const todo: { booking: Booking; alert: BookingAlert }[] = [];
  for (const booking of bookings) {
    const cancel = cancellationAlert(booking, at);
    if (cancel) todo.push({ booking, alert: cancel });
    const toBook = bookingTodoAlert(booking, at);
    if (toBook) todo.push({ booking, alert: toBook });
  }

  if (upcoming.length === 0 && todo.length === 0) {
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
    <>
      {todo.length > 0 && (
        <ul className="flex flex-col gap-2">
          {todo.map(({ booking, alert }) => (
            <li key={`${booking.id}-${alert.message}`}>
              <Card
                className={
                  alert.urgency === "now"
                    ? "flex items-center gap-3 border-s-4 border-s-warning-ink bg-warning-tint p-3"
                    : "flex items-center gap-3 border-s-4 border-s-primary bg-surface-2 p-3"
                }
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {alert.message.startsWith("ביטול") ? "💸" : "📝"}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">
                    {alert.message}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {booking.title}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

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
                  <span className="truncate font-semibold">
                    {booking.title}
                  </span>
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
    </>
  );
}
