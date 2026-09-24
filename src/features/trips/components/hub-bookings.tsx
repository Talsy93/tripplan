"use client";

import { useState } from "react";
import { Plane, Star, X } from "lucide-react";
import { Button, Dialog, SwipeAction } from "@/components/ui";
import { cn } from "@/lib/cn";
import { code128 } from "@/lib/code128";
import { AIRLINES } from "../domain/airlines";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingDetails,
  bookingNights,
  bookingStops,
  bookingTodoAlert,
  cancellationAlert,
  durationMinutesLabel,
  isStandby,
  stopsLabel,
} from "../domain/booking";
import { APP_TIME_ZONE } from "../domain/weather";
import { removeBooking } from "../application/booking-actions";
import type { Booking } from "../domain/booking";
import { BookingDetails } from "./booking-details";
import { BookingForm } from "./booking-form";
import { DomainIcon } from "./domain-icon";

// The bookings on the documents screen, drawn from the Pencil design
// (design/pencil/exports/documents-mobile.png): a flight is a white boarding
// pass with a perforation, a hotel and a train are one row each.
//
// Every figure on them is the booking's own. Where the export prints something
// no booking holds — a live "on time" status, an Apple Wallet pass — the slot
// carries the nearest true thing instead: the booking's alert, and the card
// itself opens the ticket. A pass needs a paid Apple developer account to sign,
// and a flight status needs a paid API; the rule here is free or nothing.
//
// The cards carry no edit or delete buttons, because the design draws none.
// Each card is itself the button that opens the ticket, and the ticket's
// footer is where it is corrected or removed. A swipe (or a hold) removes, as
// it does on every list in the app.
export function HubBookings({
  tripId,
  bookings: initial,
  cities,
  now,
}: {
  tripId: string;
  bookings: Booking[];
  cities: string[];
  now: string;
}) {
  // Same contract as BookingList: the prop is the truth, only pending
  // deletions are local, so a booking added through the header appears on the
  // server's next render without a reload.
  const [removed, setRemoved] = useState<string[]>([]);
  const [opened, setOpened] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const at = new Date(now);

  const bookings = initial.filter((booking) => !removed.includes(booking.id));

  async function remove(id: string) {
    setRemoved((current) => [...current, id]);
    if (!(await removeBooking(tripId, id))) {
      setRemoved((current) => current.filter((entry) => entry !== id));
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-[18px] bg-surface p-4 text-sm leading-5 text-muted shadow-card">
        עדיין אין כרטיסים. טיסות, רכבות ומלונות שתוסיפו בכפתור ״הוספת כרטיס״
        יופיעו כאן — ובמסך ״היום״ ביום שלהם.
      </div>
    );
  }

  return (
    <>
      {bookings.map((booking) => {
        // What the pill on a card says: the most pressing of the booking's
        // own alerts, else what state it is in. A live "on time" is a flight
        // status, which this app has no free source for.
        const alert =
          bookingAlert(booking, at)?.message ??
          cancellationAlert(booking, at)?.message ??
          bookingTodoAlert(booking, at)?.message ??
          (isStandby(booking)
            ? "סטנד-ביי"
            : !booking.booked
              ? "לא הוזמן"
              : null);
        const status: Status = alert
          ? { label: alert, tone: "callout" }
          : bookingDetails(booking).paid
            ? { label: "שולם", tone: "success" }
            : { label: "הוזמן", tone: "success" };
        const open = () => setOpened(booking);

        return (
          <SwipeAction
            key={booking.id}
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            onAction={() => setConfirming(booking)}
          >
            {booking.kind === "flight" ? (
              <BoardingPass booking={booking} status={status} onOpen={open} />
            ) : booking.kind === "lodging" ? (
              <HotelCard booking={booking} status={status} onOpen={open} />
            ) : (
              <TrainCard booking={booking} status={status} onOpen={open} />
            )}
          </SwipeAction>
        );
      })}

      {opened && (
        <BookingDetails
          booking={opened}
          open
          onClose={() => setOpened(null)}
          onEdit={() => {
            setEditing(opened);
            setOpened(null);
          }}
          onRemove={() => {
            setConfirming(opened);
            setOpened(null);
          }}
        />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `עריכת ${BOOKING_KINDS[editing.kind].label}` : ""}
      >
        {editing && (
          <BookingForm
            key={editing.id}
            tripId={tripId}
            cities={cities}
            booking={editing}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={
          confirming
            ? `להסיר את ${BOOKING_KINDS[confirming.kind].label} "${confirming.title}"?`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              ביטול
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = confirming;
                setConfirming(null);
                if (target) void remove(target.id);
              }}
            >
              הסרה
            </Button>
          </>
        }
      >
        <p className="text-sm">
          ההזמנה תיעלם גם מהלו״ז של היום שלה. אין דרך לשחזר — אבל אפשר להוסיף
          אותה מחדש.
        </p>
      </Dialog>
    </>
  );
}

// ---- the status pill ----------------------------------------------------------

// What the pill on a card says, and in which colour. Green is a settled fact
// ("הוזמן", "שולם"); the orange callout tint is something still to do or to
// watch — a deadline, a standby, a ticket not yet bought.
type Status = { label: string; tone: "success" | "callout" };

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "max-w-36 shrink-0 truncate rounded-full px-2.5 py-1 text-xs leading-4 font-semibold",
        status.tone === "success"
          ? "bg-success-tint text-success-ink"
          : "bg-callout-tint text-callout-ink",
      )}
      suppressHydrationWarning
    >
      {status.label}
    </span>
  );
}

// ---- the flight: a boarding pass --------------------------------------------

// A white card now, not the teal gradient band: the Pencil design keeps colour
// for the status pill and lets the two airport codes carry the card. The whole
// card is the button that opens the ticket, so there is no separate "פרטי
// הכרטיס" control to find.
function BoardingPass({
  booking,
  status,
  onOpen,
}: {
  booking: Booking;
  status: Status;
  onOpen: () => void;
}) {
  const details = bookingDetails(booking);
  const airline = booking.airline
    ? (AIRLINES.find((entry) => entry.code === booking.airline)?.name ?? null)
    : null;
  const stops = bookingStops(booking).length;
  const hasGrid = Boolean(
    details.seat || details.gate || details.boarding || details.baggage,
  );
  const bars = booking.confirmation ? code128(booking.confirmation) : null;
  // The arrival's date only when it is not the departure's — an overnight
  // flight lands on another day, and that is worth the extra characters.
  const arrivesOtherDay =
    booking.ends_at !== null &&
    dayMonth(booking.ends_at) !== dayMonth(booking.starts_at);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`פרטי הטיסה ${booking.title}`}
      className="block w-full rounded-[18px] bg-surface p-4 text-start shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs leading-4 text-muted">
          {airline && <>{airline} · </>}
          <span dir="ltr">{booking.title}</span>
          <span suppressHydrationWarning> · {shortDay(booking.starts_at)}</span>
        </span>
        <StatusPill status={status} />
      </div>

      {/* Origin on the start edge (the right, in Hebrew) and destination on
          the end, with the plane flying the way the line reads. */}
      <div className="mt-3 flex items-center gap-2">
        <PassEnd place={booking.origin} time={clock(booking.starts_at)} />
        <div className="flex min-w-16 flex-1 flex-col items-center">
          {typeof booking.duration_minutes === "number" && (
            <span className="text-[11px] leading-4 whitespace-nowrap text-muted">
              {durationMinutesLabel(booking.duration_minutes)}
            </span>
          )}
          <div className="flex w-full items-center gap-1">
            <div className="h-px flex-1 bg-border" />
            <Plane
              className="h-4 w-4 shrink-0 -rotate-[135deg] text-primary"
              aria-hidden="true"
            />
            <div className="h-px flex-1 bg-border" />
          </div>
          <span className="text-[11px] leading-4 whitespace-nowrap text-muted">
            {stops > 0 ? stopsLabel(stops) : "ישירה"}
          </span>
        </div>
        <PassEnd
          place={booking.destination}
          time={
            booking.ends_at
              ? arrivesOtherDay
                ? `${dayMonth(booking.ends_at)} · ${clock(booking.ends_at)}`
                : clock(booking.ends_at)
              : null
          }
          end
        />
      </div>

      {(hasGrid || bars || booking.confirmation) && (
        // The perforation.
        <div className="my-3 border-t-2 border-dashed border-border" />
      )}

      {hasGrid && (
        <div className="grid grid-cols-4 gap-2">
          <PassFact label="מושב" value={details.seat} />
          <PassFact label="שער" value={details.gate} />
          <PassFact label="עלייה" value={details.boarding} />
          <PassFact label="מזוודה" value={details.baggage} />
        </div>
      )}

      {bars ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            hasGrid && "mt-3",
          )}
        >
          <span
            dir="ltr"
            className="min-w-0 truncate text-xs font-semibold text-muted"
          >
            {booking.confirmation}
          </span>
          <Barcode bars={bars} label={booking.confirmation ?? ""} />
        </div>
      ) : booking.confirmation ? (
        <span
          dir="ltr"
          className={cn(
            "block text-xs font-semibold text-muted wrap-anywhere",
            hasGrid && "mt-3",
          )}
        >
          {booking.confirmation}
        </span>
      ) : null}
    </button>
  );
}

function PassEnd({
  place,
  time,
  end = false,
}: {
  place: string | null;
  time: string | null;
  end?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 basis-0 flex-col",
        end ? "items-end text-end" : "items-start text-start",
      )}
    >
      <span
        dir="auto"
        className="max-w-full text-[28px] leading-9 font-bold tracking-tight text-foreground wrap-anywhere"
      >
        {place ?? "—"}
      </span>
      {time && (
        <span
          className="text-xs leading-4 text-muted tabular-nums"
          suppressHydrationWarning
        >
          {time}
        </span>
      )}
    </div>
  );
}

function PassFact({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] leading-4 text-muted">{label}</span>
      <span
        dir="auto"
        className="block truncate text-base leading-6 font-bold text-foreground"
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// A real Code 128 of the confirmation code — it scans. Squeezed to a fixed
// width rather than drawn at one pixel a module, so a long code does not push
// the row off the card; uniform scaling keeps the ratios a scanner reads.
function Barcode({ bars, label }: { bars: number[]; label: string }) {
  // Each bar's x is the sum of every width before it.
  const starts = bars.map((_, index) =>
    bars.slice(0, index).reduce((sum, width) => sum + width, 0),
  );
  const total = bars.reduce((sum, width) => sum + width, 0);
  return (
    <svg
      viewBox={`0 0 ${total} 28`}
      preserveAspectRatio="none"
      className="h-7 w-[104px] shrink-0 text-foreground"
      role="img"
      aria-label={`ברקוד של ${label}`}
    >
      {bars.map((width, index) =>
        index % 2 === 0 ? (
          <rect
            key={index}
            x={starts[index]}
            y={0}
            width={width}
            height={28}
            fill="currentColor"
          />
        ) : null,
      )}
    </svg>
  );
}

// ---- the hotel and the train: one row each -----------------------------------

// The Pencil row: a teal-tinted icon tile on the start edge, the name and one
// line of facts, and the status pill on the end. The whole row opens the
// ticket, as the boarding pass does.
function BookingRow({
  booking,
  title,
  meta,
  status,
  onOpen,
}: {
  booking: Booking;
  title: React.ReactNode;
  meta: string;
  status: Status;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-w-0 items-center gap-3 rounded-[18px] bg-surface p-4 text-start shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-primary-tint text-primary"
        aria-hidden="true"
      >
        <DomainIcon name={BOOKING_KINDS[booking.kind].icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-6 font-semibold text-foreground wrap-anywhere">
          {title}
        </span>
        {meta && (
          <span
            className="block truncate text-xs leading-[18px] text-muted"
            suppressHydrationWarning
          >
            {meta}
          </span>
        )}
      </span>
      <StatusPill status={status} />
    </button>
  );
}

function HotelCard({
  booking,
  status,
  onOpen,
}: {
  booking: Booking;
  status: Status;
  onOpen: () => void;
}) {
  const details = bookingDetails(booking);
  const nights = bookingNights(booking);
  // The dates, the nights, breakfast and the confirmation code, on one line —
  // the address is a detail and lives in the full ticket.
  const meta = [
    stayRange(booking.starts_at, booking.ends_at),
    nights === null ? null : nights === 1 ? "לילה אחד" : `${nights} לילות`,
    details.breakfast ? "ארוחת בוקר" : null,
    booking.confirmation ? `#${booking.confirmation}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <BookingRow
      booking={booking}
      status={status}
      onOpen={onOpen}
      meta={meta}
      title={
        // No `dir="auto"` on the name: a Latin hotel name in an RTL card
        // still sits on the start edge, as the design draws it.
        <span className="inline-flex max-w-full flex-wrap items-center gap-1">
          <span className="min-w-0">{booking.title}</span>
          {details.stars && (
            <span
              className="inline-flex shrink-0 text-callout"
              aria-label={`${details.stars} כוכבים`}
            >
              {Array.from({ length: details.stars }, (_, index) => (
                <Star
                  key={index}
                  className="h-3 w-3 fill-current"
                  aria-hidden="true"
                />
              ))}
            </span>
          )}
        </span>
      }
    />
  );
}

function TrainCard({
  booking,
  status,
  onOpen,
}: {
  booking: Booking;
  status: Status;
  onOpen: () => void;
}) {
  const details = bookingDetails(booking);
  // "רכבת רומא ← פירנצה": the journey is the name; the train's number is a
  // fact on the line under it. The arrow points the way Hebrew reads.
  const headline =
    booking.origin && booking.destination
      ? `רכבת ${booking.origin} ← ${booking.destination}`
      : booking.destination
        ? `רכבת ל${booking.destination}`
        : booking.title;
  const meta = [
    `${shortDay(booking.starts_at)} ${clock(booking.starts_at)}`,
    headline !== booking.title ? booking.title : null,
    details.carriage ? `קרון ${details.carriage}` : null,
    details.seat ? `מושב ${details.seat}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <BookingRow
      booking={booking}
      status={status}
      onOpen={onOpen}
      meta={meta}
      title={headline}
    />
  );
}

// ---- formatting, always in the trip's zone ----------------------------------

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// "11.4": day and month, unpadded, joined with a dot whatever the locale's
// own separator is.
function dayMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat("he-IL", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso));
  const part = (type: "day" | "month") =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}`;
}

// "14–18.5", or across a month boundary "30.4–2.5" — the row's one line of
// facts has room for figures, not for month names. The nights follow it as
// their own fact.
function stayRange(start: string, end: string | null): string {
  if (!end) return `מ-${dayMonth(start)}`;
  const [startDay, startMonth] = dayMonth(start).split(".");
  const [endDay, endMonth] = dayMonth(end).split(".");
  return startMonth === endMonth
    ? `${startDay}–${endDay}.${endMonth}`
    : `${startDay}.${startMonth}–${endDay}.${endMonth}`;
}

// "א׳ 11.4" — the weekday letter and the date, as the design's cards print it.
function shortDay(iso: string): string {
  const weekday = new Date(iso)
    .toLocaleDateString("he-IL", { timeZone: APP_TIME_ZONE, weekday: "short" })
    .replace("יום ", "");
  return `${weekday} ${dayMonth(iso)}`;
}
