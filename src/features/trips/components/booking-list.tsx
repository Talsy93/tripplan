"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
  IconButton,
  SegmentedControl,
  type SegmentedItem,
} from "@/components/ui";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingNights,
  bookingTodoAlert,
  bookingWhere,
  cancellationAlert,
  doubleBookedLodgingIds,
} from "../domain/booking";
import { APP_TIME_ZONE } from "../domain/weather";
import { removeBooking } from "../application/booking-actions";
import type { Booking, BookingAlert, BookingKind } from "../domain/booking";

const ALERT_TONE: Record<BookingAlert["urgency"], "warning" | "action" | "neutral"> =
  {
    now: "warning",
    soon: "action",
    upcoming: "neutral",
  };

type Filter = "all" | BookingKind;

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
  // The prop is the source of truth, and only pending deletions are held
  // locally.
  //
  // This used to be `useState(initial)`, which snapshotted the list at mount —
  // so a booking added by the form did not appear even though the Server Action
  // revalidated the route: the server sent new props and useState ignored them.
  // It only showed up after a manual reload, which looked like the save had
  // failed.
  const [removed, setRemoved] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const asOf = new Date(now);

  const bookings = initial.filter((booking) => !removed.includes(booking.id));

  async function remove(id: string) {
    setRemoving(id);
    // Optimistic: hide it now, put it back if the delete did not take.
    setRemoved((current) => [...current, id]);

    if (!(await removeBooking(tripId, id))) {
      setRemoved((current) => current.filter((entry) => entry !== id));
    }
    setRemoving(null);
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon="🧳"
        title="עדיין אין הזמנות"
        description="הוסיפו טיסה, רכבת או לינה, והן יופיעו כאן ובמסך ״היום״ לפי התאריך."
      />
    );
  }

  const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.kind] = (acc[booking.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Only the kinds actually present get a tab — an empty "trains" filter is a
  // dead end, not a feature.
  const segments: SegmentedItem[] = [
    { id: "all", label: "הכול", count: bookings.length },
    ...(Object.keys(BOOKING_KINDS) as BookingKind[])
      .filter((kind) => counts[kind])
      .map((kind) => ({
        id: kind,
        label: BOOKING_KINDS[kind].label,
        count: counts[kind],
      })),
  ];

  const shown =
    filter === "all"
      ? bookings
      : bookings.filter((booking) => booking.kind === filter);

  // Computed over every booking, not just the visible ones: two hotels clash
  // whether or not a filter happens to be showing both of them.
  const doubleBooked = doubleBookedLodgingIds(bookings, APP_TIME_ZONE);

  return (
    <div className="flex flex-col gap-4">
      {doubleBooked.size > 0 && (
        <p className="rounded-control bg-warning-tint px-3 py-2 text-sm text-warning-ink">
          ⚠️ יש לכם {doubleBooked.size} לינות שחופפות באותם לילות. אם הזמנתם שתי
          אפשרויות כדי להחליט אחר כך — כדאי לבטל אחת מהן לפני שמועד הביטול
          החינם עובר.
        </p>
      )}
      {segments.length > 2 && (
        <SegmentedControl
          items={segments}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
          aria-label="סינון הזמנות"
        />
      )}

      <ul className="flex flex-col gap-3">
        {shown.map((booking) => {
          const kind = BOOKING_KINDS[booking.kind];
          const nights = bookingNights(booking);
          const clashing = doubleBooked.has(booking.id);

          // Three alerts can apply at once — a hotel can be starting soon, be
          // cancellable until Thursday, and clash with another. They are
          // rendered together rather than one winning, because they are
          // different facts and hiding any of them loses information.
          const alerts = [
            bookingAlert(booking, asOf),
            cancellationAlert(booking, asOf),
            bookingTodoAlert(booking, asOf),
          ].filter((entry): entry is BookingAlert => entry !== null);

          return (
            <li key={booking.id}>
              <Card className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4 pb-2">
                  {/* Wraps rather than squeezing: an alert like "departing in
                      2 hours" is wider than the title on a phone, and a
                      truncated flight number is worse than a second line. */}
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span aria-hidden="true">{kind.emoji}</span>
                    <span className="truncate font-semibold">
                      {booking.title}
                    </span>
                    {clashing && (
                      <Badge tone="warning" className="shrink-0">
                        לינה כפולה
                      </Badge>
                    )}
                    {alerts.map((alert) => (
                      <Badge
                        key={alert.message}
                        tone={ALERT_TONE[alert.urgency]}
                        className="shrink-0"
                        suppressHydrationWarning
                      >
                        {alert.message}
                      </Badge>
                    ))}
                  </span>

                  <IconButton
                    label={`הסר ${kind.label}`}
                    variant="danger"
                    size="sm"
                    disabled={removing === booking.id}
                    onClick={() => void remove(booking.id)}
                  >
                    ✕
                  </IconButton>
                </div>

                {kind.isTransport ? (
                  <TransportLeg booking={booking} />
                ) : (
                  <StayLeg booking={booking} nights={nights} />
                )}

                {(booking.confirmation ||
                  booking.note ||
                  booking.free_cancellation_until ||
                  (!booking.booked && booking.book_by)) && (
                  <div className="flex flex-col gap-1 border-t border-dashed border-border px-4 py-3 text-xs text-muted">
                    {booking.confirmation && (
                      <span dir="ltr" className="tabular-nums">
                        קוד הזמנה: {booking.confirmation}
                      </span>
                    )}
                    {/* Shown even when no alert is active, so the deadline that
                        was entered is visible rather than only surfacing days
                        later when it becomes urgent. */}
                    {booking.free_cancellation_until && (
                      <span>
                        ביטול חינם עד {formatDay(booking.free_cancellation_until)}
                      </span>
                    )}
                    {!booking.booked && booking.book_by && (
                      <span>להזמין עד {formatDay(booking.book_by)}</span>
                    )}
                    {booking.note && <span>{booking.note}</span>}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A flight or train, laid out the way a ticket is: where you leave, where you
// land, and the line between them. Forced LTR because origin → destination
// reads left to right on every ticket in the world, including Hebrew ones.
function TransportLeg({ booking }: { booking: Booking }) {
  return (
    <div dir="ltr" className="flex items-center gap-3 px-4 pb-4">
      <Endpoint place={booking.origin} when={booking.starts_at} />

      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex w-full items-center gap-1">
          <span className="h-px flex-1 border-t border-dashed border-border" />
          <Plane className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="h-px flex-1 border-t border-dashed border-border" />
        </div>
      </div>

      <Endpoint place={booking.destination} when={booking.ends_at} align="end" />
    </div>
  );
}

function Endpoint({
  place,
  when,
  align = "start",
}: {
  place: string | null;
  when: string | null;
  align?: "start" | "end";
}) {
  return (
    <div className={align === "end" ? "text-right" : "text-left"}>
      <p className="font-display text-lg leading-tight">{place ?? "—"}</p>
      {when && (
        <p
          className="text-xs tabular-nums text-muted"
          suppressHydrationWarning
        >
          {formatWhen(when)}
        </p>
      )}
    </div>
  );
}

function StayLeg({
  booking,
  nights,
}: {
  booking: Booking;
  nights: number | null;
}) {
  const where = bookingWhere(booking);
  return (
    <div className="flex flex-col gap-1 px-4 pb-4">
      {where && <span className="truncate text-sm text-muted">{where}</span>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {/* Times render in the viewer's timezone and locale, which the server
            doesn't share — the first client render can legitimately differ. */}
        <span dir="ltr" className="tabular-nums" suppressHydrationWarning>
          {formatWhen(booking.starts_at)}
          {booking.ends_at && ` → ${formatWhen(booking.ends_at)}`}
        </span>
        {nights !== null && (
          <span>{nights === 1 ? "לילה אחד" : `${nights} לילות`}</span>
        )}
      </div>
    </div>
  );
}

// A deadline is stored as a plain YYYY-MM-DD (a `date` column), so it is
// reformatted by splitting the string rather than by parsing it into a Date —
// `new Date("2026-09-10")` is UTC midnight and would print the 9th for any
// reader west of Greenwich.
function formatDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
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
