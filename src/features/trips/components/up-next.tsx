import { Badge, Banner, EmptyState, Glyph, ListRow } from "@/components/ui";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingTodoAlert,
  bookingWhere,
  cancellationAlert,
} from "../domain/booking";
import { cn } from "@/lib/cn";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { Booking, BookingAlert } from "../domain/booking";
import { DomainIcon } from "./domain-icon";
import { Compass } from "lucide-react";

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
  enterDelayMs = 0,
}: {
  bookings: Booking[];
  now: string;
  cities?: string[];
  // Where the rows' entrance starts, in ms — see OpenItems and TripList for why
  // a nested list has to be told. Default 0.
  enterDelayMs?: number;
}) {
  // Inherited by every row from the list, which is what lets the per-row delays
  // add to it instead of being overridden by it. See globals.css.
  const baseStyle =
    enterDelayMs > 0
      ? ({ "--stagger-base": `${enterDelayMs}ms` } as React.CSSProperties)
      : undefined;

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
        icon={<Compass />}
        title="אין עדיין מה לתזמן"
        description="טיסות, רכבות ולינה שתוסיפו בטאב ״עוד״ יופיעו כאן לפי הסדר."
      />
    );
  }

  const tones = cityToneMap(cities);

  return (
    <>
      {todo.length > 0 && (
        <ul className="stagger flex flex-col gap-2" style={baseStyle}>
          {todo.map(({ booking, alert }) => (
            <li key={`${booking.id}-${alert.message}`} className="animate-rise">
              {/* Banner rather than a card with a coloured stripe. The icon used
                  to be chosen by alert.message.startsWith("ביטול"), which works
                  right up until somebody rewords a sentence. */}
              <Banner tone={alert.urgency === "now" ? "callout" : "info"}>
                <span className="font-semibold">{alert.message}</span>
                <span className="text-muted"> · {booking.title}</span>
              </Banner>
            </li>
          ))}
        </ul>
      )}

      {/* Both lists take the same base rather than the second continuing the
          first. They are two groups — what to do, and what is coming — and
          chaining them would make the last deadline land after the flight
          underneath it. */}
      <ul className="stagger flex flex-col gap-2" style={baseStyle}>
        {upcoming.map((booking) => {
          const kind = BOOKING_KINDS[booking.kind];
          const alert = bookingAlert(booking, at);
          const where = bookingWhere(booking);

          return (
            <li
              key={booking.id}
              className={cn("animate-rise", cityToneClass(tones, booking.city))}
            >
              <ListRow
                // No accent dot any more. The tile below carries the city
                // colour, and a dot beside it said the same thing twice — two
                // marks for one fact, which is how a row starts to look busy
                // without saying more.
                leading={
                  <Glyph tone>
                    <DomainIcon name={kind.icon} />
                  </Glyph>
                }
                title={booking.title}
                subtitle={where ?? undefined}
              >
                {/* Under the title, not beside it. As `trailing` the badge was
                    shrink-0 and the title was not, so "צ׳ק-אין היום, בעוד 6
                    שעות" — 26 characters — took its full width at 375px and
                    truncated the hotel name to nine. The name is the thing being
                    identified; the timing is what is said about it. */}
                {alert && (
                  <Badge
                    tone={alert.urgency === "now" ? "warning" : "neutral"}
                    className="self-start"
                    suppressHydrationWarning
                  >
                    {alert.message}
                  </Badge>
                )}
              </ListRow>
            </li>
          );
        })}
      </ul>
    </>
  );
}
