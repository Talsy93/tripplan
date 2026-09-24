import { Badge, Banner, EmptyState } from "@/components/ui";
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
      {/* One white card of rows (Pencil, v7), each with its kind on a tile in
          the city's tone. A card per booking was three boxes saying one list. */}
      {upcoming.length > 0 && (
        <ul
          className="stagger overflow-hidden rounded-[1.25rem] bg-surface px-4 shadow-card"
          style={baseStyle}
        >
          {upcoming.map((booking) => {
            const kind = BOOKING_KINDS[booking.kind];
            const alert = bookingAlert(booking, at);
            const where = bookingWhere(booking);

            return (
              <li
                key={booking.id}
                className={cn(
                  "animate-rise flex min-h-16 min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0",
                  cityToneClass(tones, booking.city),
                )}
              >
                {/* The tile carries the city colour; no dot beside it saying
                    the same thing twice. */}
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tone text-tone-ink"
                >
                  <DomainIcon name={kind.icon} className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base leading-6 font-semibold text-foreground">
                    {booking.title}
                  </span>
                  {where && <span className="truncate text-xs text-muted">{where}</span>}
                  {/* Under the title, not beside it. As a trailing badge it
                      was shrink-0 and the title was not, so "צ׳ק-אין היום,
                      בעוד 6 שעות" took its full width at 375px and truncated
                      the hotel name to nine characters. */}
                  {alert && (
                    <Badge
                      tone={alert.urgency === "now" ? "warning" : "neutral"}
                      className="self-start"
                      suppressHydrationWarning
                    >
                      {alert.message}
                    </Badge>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
