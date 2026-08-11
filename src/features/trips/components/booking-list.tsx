"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { removeBooking } from "../application/booking-actions";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingNights,
  bookingWhere,
} from "../domain/booking";
import type { Booking, BookingAlert } from "../domain/booking";

const ALERT_STYLES: Record<BookingAlert["urgency"], string> = {
  now: "bg-accent/15 text-accent",
  soon: "bg-primary/10 text-primary",
  upcoming: "bg-surface-2 text-muted",
};

export function BookingList({
  tripId,
  bookings: initial,
  // Passed in from the server render so both sides agree on what "now" is
  // instead of disagreeing across hydration.
  now,
}: {
  tripId: string;
  bookings: Booking[];
  now: string;
}) {
  const [bookings, setBookings] = useState(initial);
  const [removing, setRemoving] = useState<string | null>(null);
  const asOf = new Date(now);

  async function remove(id: string) {
    setRemoving(id);
    const previous = bookings;
    setBookings((current) => current.filter((booking) => booking.id !== id));

    if (!(await removeBooking(tripId, id))) {
      setBookings(previous);
    }
    setRemoving(null);
  }

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-muted">
        עדיין לא הוספתם טיסות, רכבות או לינה.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {bookings.map((booking) => {
        const kind = BOOKING_KINDS[booking.kind];
        const alert = bookingAlert(booking, asOf);
        const nights = bookingNights(booking);
        const where = bookingWhere(booking);

        return (
          <li key={booking.id}>
            <Card className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{kind.emoji}</span>
                    <span className="truncate font-semibold">
                      {booking.title}
                    </span>
                    {alert && (
                      <Badge
                        className={cn("shrink-0", ALERT_STYLES[alert.urgency])}
                        suppressHydrationWarning
                      >
                        {alert.message}
                      </Badge>
                    )}
                  </span>
                  {where && (
                    <span className="truncate text-sm text-muted">{where}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void remove(booking.id)}
                  disabled={removing === booking.id}
                  aria-label={`הסר ${kind.label}`}
                  className="shrink-0 text-muted transition-colors hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {/* Times and alerts are rendered in the viewer's timezone and
                    locale, which the server doesn't share — so the first
                    client render can legitimately differ from the SSR output. */}
                <span
                  dir="ltr"
                  className="tabular-nums"
                  suppressHydrationWarning
                >
                  {formatWhen(booking.starts_at)}
                  {booking.ends_at && ` → ${formatWhen(booking.ends_at)}`}
                </span>
                {nights !== null && (
                  <span>{nights === 1 ? "לילה אחד" : `${nights} לילות`}</span>
                )}
                {booking.confirmation && (
                  <span dir="ltr">אישור: {booking.confirmation}</span>
                )}
              </div>

              {booking.note && (
                <p className="text-sm text-muted">{booking.note}</p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
