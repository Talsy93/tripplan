"use client";

import { ArrowLeft, Clock, Hash, Plane, Wallet } from "lucide-react";
import { Badge, Dialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  BOOKING_KINDS,
  bookingWhere,
  flightRoute,
  layoverLabel,
} from "../domain/booking";
import { formatMoney } from "../domain/expenses";
import { APP_TIME_ZONE } from "../domain/weather";
import type { Booking, RouteLeg } from "../domain/booking";
import { DomainIcon } from "./domain-icon";

// The whole ticket, from a row on a day.
//
// Asked for as "when you press them, the flight's details should come up". The
// timeline row has room for a time, a name and two airport codes, and a ticket
// is more than that: the legs it is actually made of, how long the wait in the
// middle is, the confirmation code you will be asked for at the desk, what it
// cost.
//
// Read-only on purpose. Editing a booking lives on the trip's details screen,
// where the form and the list are; this is the day asking "what is this", not
// the place you correct it. That also keeps it safe to open with a thumb while
// standing in a queue.
//
// Built from flightRoute, which is the same function that decides what a
// connection means everywhere else — see journeyLegs in domain/booking.
export function BookingDetails({
  booking,
  open,
  onClose,
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
}) {
  const kind = BOOKING_KINDS[booking.kind];
  const { legs, stops } = flightRoute(booking);
  const money =
    booking.cost_amount !== null && booking.cost_currency
      ? formatMoney(booking.cost_amount, booking.cost_currency)
      : null;
  const duration = booking.duration_minutes ?? null;
  // The journey is the title; the number is a detail. Same call the booking
  // list makes — "LY086" identifies the ticket to an airline and tells the
  // traveller nothing, while the two ends are what the ticket is.
  const route = kind.isTransport ? bookingWhere(booking) : null;

  return (
    <Dialog open={open} onClose={onClose} title={route ?? booking.title}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <DomainIcon name={kind.icon} className="h-3.5 w-3.5" />
            {kind.label}
          </Badge>
          {booking.airline && <Badge tone="neutral">{booking.airline}</Badge>}
          {booking.standby && <Badge tone="callout">סטנד-ביי</Badge>}
          {!booking.booked && <Badge tone="callout">עוד לא הוזמן</Badge>}
        </div>

        {/* Leg, wait, leg. legs.length is always stops.length + 1, so the two
            can be walked together without checking the ends. */}
        <ol className="flex min-w-0 flex-col gap-2">
          {legs.map((leg, index) => {
            // The stop *after* this leg, which the last leg does not have —
            // legs.length is stops.length + 1.
            const stop = stops[index];
            const wait = stop?.layoverMinutes ?? null;

            return (
              <li key={index} className="flex min-w-0 flex-col gap-2">
                <Leg leg={leg} number={legs.length > 1 ? index + 1 : null} />
                {stop && (
                  <div className="flex items-center gap-2 ps-3 text-caption text-muted">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      עצירה ב{stop.place}
                      {wait !== null && ` · ${layoverLabel(wait)}`}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <dl className="flex min-w-0 flex-col gap-2 border-t border-dashed border-border pt-3">
          {/* Where the identifier lives now: with the confirmation code, which
              is the other string you are read back at a desk. */}
          {route && (
            <Row icon={<Plane className="h-4 w-4" />} label={kind.label}>
              <span dir="ltr" className="font-semibold tabular-nums">
                {booking.title}
              </span>
            </Row>
          )}
          {booking.confirmation && (
            <Row icon={<Hash className="h-4 w-4" />} label="קוד הזמנה">
              {/* Selectable and LTR: this is the string you read out at a desk
                  or paste into an airline's site. */}
              <span dir="ltr" className="select-all font-semibold tabular-nums">
                {booking.confirmation}
              </span>
            </Row>
          )}
          {money && (
            <Row icon={<Wallet className="h-4 w-4" />} label="עלות">
              <span dir="ltr" className="tabular-nums">
                {money}
              </span>
            </Row>
          )}
          {/* `?? null` and not `!== null`: the column was added in 0020, so the
              field is optional in the schema and can be undefined on a row that
              predates it — which `!== null` lets straight through. */}
          {duration !== null && (
            <Row icon={<Clock className="h-4 w-4" />} label="משך">
              {durationLabel(duration)}
            </Row>
          )}
        </dl>

        {booking.note && (
          <p className="text-sm text-muted wrap-anywhere">{booking.note}</p>
        )}
      </div>
    </Dialog>
  );
}

function Leg({ leg, number }: { leg: RouteLeg; number: number | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-control border border-border bg-surface-sunken p-3">
      {(number !== null || leg.flight) && (
        <span className="flex flex-wrap items-baseline gap-x-2 text-caption text-muted">
          {number !== null && <span className="font-bold">קטע {number}</span>}
          {leg.flight && <span>{leg.flight}</span>}
          {leg.airline && <span>· {leg.airline}</span>}
        </span>
      )}

      {/* Forced LTR: origin → destination reads left to right on every ticket in
          the world, the same call the timeline's ticket row makes. */}
      <div dir="ltr" className="flex min-w-0 items-center gap-2">
        <End place={leg.from} at={leg.departsAt} />
        <ArrowLeft
          className="h-3.5 w-3.5 shrink-0 rotate-180 text-border-strong"
          aria-hidden="true"
        />
        <End place={leg.to} at={leg.arrivesAt} align="end" />
      </div>
    </div>
  );
}

function End({
  place,
  at,
  align = "start",
}: {
  place: string | null;
  at: string | null;
  align?: "start" | "end";
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        align === "end" && "items-end text-end",
      )}
    >
      <span className="min-w-0 truncate text-sm font-semibold">
        {place ?? "—"}
      </span>
      <span className="text-caption tabular-nums text-muted">
        {at ? clock(at) : "—"}
      </span>
    </span>
  );
}

// The wall clock of an instant in the trip's zone — the same zone the timeline
// reads, so a departure cannot say 23:40 on one screen and 21:40 on the next.
function clock(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} דק׳`;
  if (rest === 0) return hours === 1 ? "שעה" : `${hours} שעות`;
  return `${hours}:${String(rest).padStart(2, "0")} שעות`;
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="ms-auto min-w-0 text-end">{children}</dd>
    </div>
  );
}
