"use client";

import { useState } from "react";
import {
  CircleCheck,
  Coffee,
  FileText,
  Plane,
  QrCode,
  Ticket,
  X,
} from "lucide-react";
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

// The bookings on the documents screen, drawn card for card from the Stitch
// export (design/stitch/…/_3): a flight is a boarding pass with a torn edge, a
// hotel is a confirmation card, a train is a single row.
//
// Every figure on them is the booking's own. Where the export prints something
// no booking holds — a live "on time" status, an Apple Wallet pass — the slot
// carries the nearest true thing instead: the booking's alert, and the button
// that opens the ticket. A pass needs a paid Apple developer account to sign,
// and a flight status needs a paid API; the rule here is free or nothing.
//
// The cards carry no edit or delete buttons, because the export draws none.
// Each card's own action — "פרטי הכרטיס", "כל הפרטים", the round QR button —
// opens the ticket, and the ticket's footer is where it is corrected or
// removed. A swipe (or a hold) removes, as it does on every list in the app.
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
      <div className="rounded-xl bg-surface p-4 text-sm leading-5 text-muted-strong shadow-card">
        עדיין אין כרטיסים. טיסות, רכבות ומלונות שתוסיפו בכפתור ״הוספת כרטיס״
        יופיעו כאן — ובמסך ״היום״ ביום שלהם.
      </div>
    );
  }

  return (
    <>
      {bookings.map((booking) => {
        // What the pill on a card says, when anything: the most pressing of
        // the booking's own alerts, or its status. The export's "בזמן להמראה"
        // is a live flight status, which this app has no free source for.
        const pill =
          bookingAlert(booking, at)?.message ??
          cancellationAlert(booking, at)?.message ??
          bookingTodoAlert(booking, at)?.message ??
          (isStandby(booking)
            ? "סטנד-ביי"
            : !booking.booked
              ? "עוד לא הוזמן"
              : null);
        const open = () => setOpened(booking);

        return (
          <SwipeAction
            key={booking.id}
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            onAction={() => setConfirming(booking)}
          >
            {booking.kind === "flight" ? (
              <BoardingPass booking={booking} pill={pill} onOpen={open} />
            ) : booking.kind === "lodging" ? (
              <HotelCard booking={booking} pill={pill} onOpen={open} />
            ) : (
              <TrainCard booking={booking} onOpen={open} />
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

// ---- the flight: a boarding pass --------------------------------------------

function BoardingPass({
  booking,
  pill,
  onOpen,
}: {
  booking: Booking;
  pill: string | null;
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

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface shadow-card">
      {/* The header band. `bg-gradient-to-l`, physical, as the export has it:
          the light end sits on the left in both directions. */}
      <div className="bg-gradient-to-l from-primary to-primary-bright p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Ticket className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-base leading-[22px] font-semibold">
              {airline ? `${airline} · ` : ""}
              <span dir="ltr">{booking.title}</span>
            </span>
          </div>
          {pill && (
            <span
              className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-success-strong shadow-xs"
              suppressHydrationWarning
            >
              {pill}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <PassEnd place={booking.origin} at={booking.starts_at} />
          <div className="flex flex-1 flex-col items-center px-2">
            {typeof booking.duration_minutes === "number" && (
              <span className="mb-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] whitespace-nowrap text-white/80">
                {durationMinutesLabel(booking.duration_minutes)}
              </span>
            )}
            <div className="flex w-full items-center gap-0.5">
              <div className="h-0.5 flex-1 bg-white/30" />
              <Plane
                className="h-[22px] w-[22px] shrink-0 rotate-[135deg] text-white"
                aria-hidden="true"
              />
              <div className="h-0.5 flex-1 bg-white/30" />
            </div>
            <span className="mt-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-white/90">
              {stops > 0 ? stopsLabel(stops) : "ישירה"}
            </span>
          </div>
          <PassEnd place={booking.destination} at={booking.ends_at} end />
        </div>
      </div>

      {/* The tear. Two half-discs in the page colour bite into the card's
          edges, with a dashed rule between them. Physical margins and corners,
          as in the export: the notches belong to the edges, not to a reading
          direction. */}
      <div className="relative flex h-6 items-center justify-between bg-surface px-1">
        <div className="-mr-2 h-6 w-4 rounded-l-full bg-background" />
        <div className="mx-2 flex-1 border-b-2 border-dashed border-border-strong/50" />
        <div className="-ml-2 h-6 w-4 rounded-r-full bg-background" />
      </div>

      <div className="bg-surface p-4 pt-0">
        {hasGrid && (
          <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-surface-2 py-2 text-center">
            <PassFact label="מושב" value={details.seat} />
            <PassFact label="שער" value={details.gate} accent />
            <PassFact label="עליה" value={details.boarding} />
            <PassFact label="מזוודה" value={details.baggage} />
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {bars ? (
            <div className="flex min-w-0 flex-col items-start">
              <div className="flex h-9 items-center rounded bg-surface-high px-2 py-1">
                <Barcode bars={bars} label={booking.confirmation ?? ""} />
              </div>
              <span
                dir="ltr"
                className="mt-1 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong"
              >
                {booking.confirmation}
              </span>
            </div>
          ) : booking.confirmation ? (
            <span
              dir="ltr"
              className="min-w-0 text-xs font-semibold text-muted-strong wrap-anywhere"
            >
              {booking.confirmation}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onOpen}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-surface-high px-4 py-2 text-xs leading-4 font-medium text-foreground transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ticket className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            פרטי הכרטיס
          </button>
        </div>
      </div>
    </div>
  );
}

function PassEnd({
  place,
  at,
  end = false,
}: {
  place: string | null;
  at: string | null;
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
        className="max-w-full text-[28px] leading-9 font-bold tracking-tight wrap-anywhere"
      >
        {place ?? "—"}
      </span>
      {at && (
        <>
          <span
            className="text-xs leading-[18px] text-white/80"
            suppressHydrationWarning
          >
            {dayMonth(at)}
          </span>
          <span
            className="mt-0.5 text-xs leading-4 font-semibold tabular-nums"
            suppressHydrationWarning
          >
            {clock(at)}
          </span>
        </>
      )}
    </div>
  );
}

function PassFact({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | undefined;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong">
        {label}
      </span>
      <span
        dir="auto"
        className={cn(
          "block truncate text-base leading-[22px] font-bold",
          accent && value ? "text-cta-strong" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// A real Code 128 of the confirmation code — it scans. Squeezed to a fixed
// width rather than drawn at one pixel a module, so a long code does not push
// the button off the card; uniform scaling keeps the ratios a scanner reads.
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
      className="h-7 w-[104px] text-foreground"
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

// ---- the hotel --------------------------------------------------------------

function HotelCard({
  booking,
  pill,
  onOpen,
}: {
  booking: Booking;
  pill: string | null;
  onOpen: () => void;
}) {
  const details = bookingDetails(booking);
  const nights = bookingNights(booking);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cta-tint text-cta-strong">
            <DomainIcon name={BOOKING_KINDS.lodging.icon} className="h-6 w-6" />
          </div>
          {/* No `dir="auto"` on the name: a Latin hotel name in an RTL card
              still sits on the start edge, as the export draws it. The address
              is not on the card at all — it is a detail, and it lives in the
              full ticket ("צפייה בכל הפרטים"), not on the list. */}
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <h4 className="min-w-0 text-base leading-[22px] font-semibold wrap-anywhere">
                {booking.title}
              </h4>
              {details.stars && (
                <span
                  className="flex shrink-0 text-[14px] text-cta-strong"
                  aria-label={`${details.stars} כוכבים`}
                >
                  {"★".repeat(details.stars)}
                </span>
              )}
            </div>
          </div>
        </div>
        {booking.confirmation && (
          <span
            dir="ltr"
            className="shrink-0 rounded bg-surface-high px-1 py-0.5 font-mono text-[10px] leading-[14px] font-medium tracking-[0.02em] text-muted-strong"
          >
            #{booking.confirmation}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 p-2 text-xs leading-[18px] text-foreground">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong">
            תאריכים
          </span>
          <span className="text-xs leading-4 font-semibold" suppressHydrationWarning>
            {stayRange(booking.starts_at, booking.ends_at, nights)}
          </span>
        </div>
        {details.breakfast && (
          <div className="flex shrink-0 items-center gap-1 text-success-strong">
            <Coffee className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] leading-[14px] font-semibold tracking-[0.02em]">
              ארוחת בוקר כלולה
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex min-w-0 items-center gap-1 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong">
          {details.paid ? (
            <>
              <CircleCheck
                className="h-[18px] w-[18px] shrink-0 text-success-strong"
                aria-hidden="true"
              />
              <span>שולם במלואו</span>
            </>
          ) : (
            pill && <span suppressHydrationWarning>{pill}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-0.5 rounded-control text-xs leading-4 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
          צפייה בכל הפרטים
        </button>
      </div>
    </div>
  );
}

// ---- the train --------------------------------------------------------------

function TrainCard({
  booking,
  onOpen,
}: {
  booking: Booking;
  onOpen: () => void;
}) {
  const details = bookingDetails(booking);
  const headline = booking.destination
    ? `רכבת ל${booking.destination}`
    : booking.title;
  const place = [details.carriage && `קרון ${details.carriage}`, details.seat && `מושב ${details.seat}`]
    .filter(Boolean)
    .join(", ");
  const route =
    booking.origin && booking.destination
      ? `${booking.origin} ➔ ${booking.destination}`
      : null;
  const line = [route, place].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-bright text-success-strong">
          <DomainIcon name={BOOKING_KINDS.train.icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="min-w-0 text-base leading-[22px] font-semibold text-foreground wrap-anywhere"
            >
              {headline}
            </span>
            {booking.destination && (
              <span
                dir="ltr"
                className="rounded bg-surface-sunken px-1 py-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-primary"
              >
                {booking.title}
              </span>
            )}
          </div>
          {line && (
            <p className="mt-0.5 text-xs leading-[18px] text-muted-strong wrap-anywhere">
              {line}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label="פרטי כרטיס רכבת"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-high text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <QrCode className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
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

function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  });
}

// "14 עד 18 במאי (4 לילות)", or across a month boundary "30 באפריל עד 2 במאי".
function stayRange(
  start: string,
  end: string | null,
  nights: number | null,
): string {
  const part = (iso: string, option: "day" | "month") =>
    new Date(iso).toLocaleDateString("he-IL", {
      timeZone: APP_TIME_ZONE,
      [option]: option === "day" ? "numeric" : "long",
    });
  const count =
    nights === null ? "" : nights === 1 ? " (לילה אחד)" : ` (${nights} לילות)`;

  if (!end) return `מ-${part(start, "day")} ב${part(start, "month")}`;
  const sameMonth = part(start, "month") === part(end, "month");
  return sameMonth
    ? `${part(start, "day")} עד ${part(end, "day")} ב${part(end, "month")}${count}`
    : `${part(start, "day")} ב${part(start, "month")} עד ${part(end, "day")} ב${part(end, "month")}${count}`;
}
