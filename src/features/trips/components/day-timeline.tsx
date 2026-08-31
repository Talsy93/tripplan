"use client";

import {
  ArrowUpDown,
  ChevronLeft,
  Clock,
  Footprints,
  MoonStar,
} from "lucide-react";
import { Card, Surface } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BOOKING_KINDS, bookingWhere } from "../domain/booking";
import { DEFAULT_CURRENCY, formatMoney } from "../domain/expenses";
import { APP_TIME_ZONE } from "../domain/weather";
import {
  buildDayTimeline,
  daySequence,
  distanceLabel,
  durationLabel,
  formatMinutes,
  isNightGap,
} from "../domain/timeline";
import type { Booking } from "../domain/booking";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type {
  TimelineBooking,
  TimelineEntry,
  Transition,
} from "../domain/timeline";
import { DomainIcon } from "./domain-icon";

// The day, as a stack of cards.
//
// It was an hour axis: 24 hours of height, entries positioned into it by
// percentage. On a 375px screen a day starting at 09:00 put its first real item
// below eight screens of empty grid, and a red-eye flight became a 40px sliver.
// See domain/timeline.ts (daySequence) for the ordering this renders.
//
// Two presentations, because the design draws two and they answer different
// questions:
//
//   "full"    — the ימים tab. A card per item, led by its category tile, with
//               the time as a caption over the title and a chevron saying the
//               row opens. This is the editing view.
//   "compact" — the היום tab, under the "now" card. One card, dividers, a
//               coloured spine per row. It is a reference you glance at after
//               the card above has already told you what to do, so it trades
//               room for the whole day fitting on one screen.
//
// What the axis was for is kept either way: an impossible schedule still has to
// be visible, and the gap rows carry that — "שעתיים" between two items says
// what a screenful of empty grid said.

type Variant = "full" | "compact";

export function DayTimeline({
  day,
  onEdit,
  variant = "full",
  // Where the day starts from — the lodging that covers this night, already
  // reduced to a string Google can resolve. Unused since the per-row map links
  // moved into the edit dialog; kept because the itinerary still resolves it
  // and a future row action will want it.
  bookings = [],
  date = null,
}: {
  day: ItineraryDay;
  // Opens the edit dialog. Optional so the read-only uses of this component
  // (the day pager on the "today" tab) stay read-only — and a row with nothing
  // to open renders without a chevron rather than with a dead one.
  onEdit?: (entryId: string) => void;
  variant?: Variant;
  bookings?: Booking[];
  date?: string | null;
}) {
  const timeline = buildDayTimeline(day, {
    bookings,
    date,
    zone: APP_TIME_ZONE,
  });
  const sequence = daySequence(timeline);
  const compact = variant === "compact";

  const rows = sequence.map((item) => {
    if (item.kind === "gap") {
      return (
        <GapRow
          key={item.key}
          startMinutes={item.startMinutes}
          minutes={item.minutes}
          transition={item.transition}
          compact={compact}
        />
      );
    }
    if (item.kind === "booking") {
      return (
        <BookingRow key={item.key} placed={item.booking} compact={compact} />
      );
    }
    return (
      <EntryRow
        key={item.key}
        placed={item.entry}
        compact={compact}
        onEdit={onEdit}
      />
    );
  });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* One card with dividers, or a stack of cards. The compact list is the
          only place in this app that groups rows into a single surface, and it
          earns it: the point of that screen is the whole day at once. */}
      {compact ? (
        <Card padding="none" className="divide-y divide-border overflow-hidden">
          {rows}
        </Card>
      ) : (
        rows
      )}

      {timeline.unscheduled.length > 0 && (
        <Surface tone="sunken" padding="sm" className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold text-muted">
            בלי שעה מוגדרת
          </p>
          <ul className="flex flex-col gap-1">
            {timeline.unscheduled.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={!onEdit}
                  onClick={() => onEdit?.(entry.id)}
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-control bg-surface px-2 py-1.5 text-start text-sm enabled:hover:bg-surface-2 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 truncate">{entry.title}</span>
                  {onEdit && (
                    <ChevronLeft
                      className="h-4 w-4 shrink-0 text-border-strong"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}

// The empty stretch between two items, as one row.
//
// This is the part of the hour axis worth keeping. Eight screens of grid and
// this row say the same thing, and only one of them fits on a phone.
function GapRow({
  startMinutes,
  minutes,
  transition,
  compact,
}: {
  startMinutes: number;
  minutes: number;
  transition: Transition | null;
  compact: boolean;
}) {
  const night = isNightGap(startMinutes, minutes);
  const walk = transition?.walkMinutes ?? null;
  const km = transition?.distanceKm ?? null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        compact ? "bg-surface-2 px-4 py-1.5" : "px-1.5 py-0.5",
      )}
    >
      <span className="h-px flex-1 bg-border-strong" />
      <span className="flex min-w-0 shrink items-center gap-1.5 text-caption text-muted">
        {night ? (
          <MoonStar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : walk !== null ? (
          <Footprints className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">
          {durationLabel(minutes)}
          {night && " · לילה"}
          {!night && km !== null && <> · {distanceLabel(km)}</>}
          {!night && walk !== null && <> · ~{walk} דק׳ הליכה</>}
        </span>
      </span>
      <span className="h-px flex-1 bg-border-strong" />
    </div>
  );
}

// The category tile that leads a full row. Takes the city's colour from the
// nearest .tone-* ancestor, which is what makes a long day scannable by city.
function Tile({ name }: { name: Parameters<typeof DomainIcon>[0]["name"] }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-tone text-tone-ink">
      <DomainIcon name={name} className="h-5 w-5 shrink-0" />
    </span>
  );
}

// A range, or a single time when there is no meaningful end.
function timeRange(start: number, end: number, continuesNextDay = false) {
  if (continuesNextDay) return `${formatMinutes(start)} → מחר`;
  return end > start
    ? `${formatMinutes(start)} — ${formatMinutes(end)}`
    : formatMinutes(start);
}

// A booking: paid for, timestamped, and not editable here.
//
// The full variant draws it the way a ticket is drawn — where you leave, where
// you land, and the line between them — because those are the two things a
// ticket is consulted for, and clipping either was finding 05.
function BookingRow({
  placed,
  compact,
}: {
  placed: TimelineBooking;
  compact: boolean;
}) {
  const { booking, startMinutes, endMinutes, continuesNextDay } = placed;
  const kind = BOOKING_KINDS[booking.kind];
  const where = bookingWhere(booking);

  if (compact) {
    return (
      <CompactRow
        time={formatMinutes(startMinutes)}
        title={booking.title}
        sub={where ?? null}
        icon={kind.icon}
      />
    );
  }

  const ticket = kind.isTransport && booking.origin && booking.destination;

  return (
    <Card padding="none" className="p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <Tile name={kind.icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="min-w-0 text-caption font-bold tabular-nums text-muted">
            {timeRange(startMinutes, endMinutes, continuesNextDay)}
          </span>
          <span className="min-w-0 text-sm font-bold wrap-anywhere">
            {booking.title}
          </span>
          {!ticket && where && (
            <span className="min-w-0 text-caption text-muted wrap-anywhere">
              {where}
            </span>
          )}

          {ticket && (
            // Forced LTR: origin → destination reads left to right on every
            // ticket in the world, including Hebrew ones.
            <div
              dir="ltr"
              className="mt-2 flex min-w-0 items-center gap-2 sm:gap-3"
            >
              <Endpoint
                time={formatMinutes(startMinutes)}
                place={booking.origin!}
              />
              <span className="relative h-px flex-1 bg-border">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-surface px-1 text-tone-ink">
                  <DomainIcon name={kind.icon} className="h-3.5 w-3.5" />
                </span>
              </span>
              <Endpoint
                time={
                  continuesNextDay ? "מחר" : formatMinutes(endMinutes)
                }
                place={booking.destination!}
              />
            </div>
          )}
        </div>
      </div>

      {(booking.confirmation || booking.cost_amount !== null) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-caption text-muted">
          {booking.confirmation && (
            <span>
              קוד הזמנה{" "}
              <span dir="ltr" className="font-bold text-foreground">
                {booking.confirmation}
              </span>
            </span>
          )}
          {booking.cost_amount !== null && (
            <span dir="ltr" className="tabular-nums">
              {formatMoney(booking.cost_amount, booking.cost_currency ?? DEFAULT_CURRENCY)}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

// `basis-0 flex-1`, not auto width. An airport written out in full is far wider
// than a phone, and an auto-width flex item is floored at its own min-content —
// so the row grew, and with it the page. Equal flexible thirds instead, each
// free to shrink and wrap.
function Endpoint({ time, place }: { time: string; place: string }) {
  return (
    <span className="flex min-w-0 basis-0 flex-col text-center [&:first-child]:flex-1 [&:last-child]:flex-1">
      <span className="text-sm font-black tabular-nums">{time}</span>
      <span className="min-w-0 text-caption text-muted wrap-anywhere">
        {place}
      </span>
    </span>
  );
}

function EntryRow({
  placed,
  compact,
  onEdit,
}: {
  placed: TimelineEntry;
  compact: boolean;
  onEdit?: (entryId: string) => void;
}) {
  const { entry, startMinutes, endMinutes } = placed;

  if (compact) {
    return (
      <CompactRow
        time={formatMinutes(startMinutes)}
        title={entry.title}
        sub={entry.note || null}
      />
    );
  }

  const body = (
    <>
      {/* An itinerary entry carries no category — it is a title, a time and a
          note — so there is one glyph for all of them rather than a guess per
          title. The city's colour on the tile is what distinguishes them. */}
      <Tile name="attraction" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 text-caption font-bold tabular-nums text-muted">
          {timeRange(startMinutes, endMinutes)}
        </span>
        <span className="min-w-0 text-sm font-bold wrap-anywhere">
          {entry.title}
        </span>
        {entry.note && (
          <span className="min-w-0 text-caption text-muted wrap-anywhere">
            {entry.note}
          </span>
        )}
        {/* Written by hand — knowing you need 25 minutes to get here is the
            reason it was typed in, so it is never what gets dropped. */}
        {(entry.travelNote || entry.travelMinutes !== null) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-caption text-primary-ink">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            {entry.travelMinutes !== null && (
              <span className="shrink-0 font-semibold tabular-nums">
                {entry.travelMinutes} דק׳
              </span>
            )}
            {entry.travelNote && (
              <span className="min-w-0 wrap-anywhere">{entry.travelNote}</span>
            )}
          </span>
        )}
      </div>
      {onEdit && (
        // RTL: "forward" points left. The row opens the editor — a chevron
        // rather than two icon buttons, which is both the design and one fewer
        // thing to mis-tap.
        <ChevronLeft
          className="mt-1 h-5 w-5 shrink-0 text-border-strong"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (!onEdit) {
    return (
      <Card padding="none" className="flex min-w-0 items-start gap-3 p-3.5">
        {body}
      </Card>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEdit(entry.id)}
      aria-label={`עריכת ${entry.title}`}
      className="block w-full rounded-card text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        variant="interactive"
        padding="none"
        className="flex min-w-0 items-start gap-3 p-3.5"
      >
        {body}
      </Card>
    </button>
  );
}

// One line of the compact list: time, the city's colour, what and where.
function CompactRow({
  time,
  title,
  sub,
  icon,
}: {
  time: string;
  title: string;
  sub: string | null;
  icon?: Parameters<typeof DomainIcon>[0]["name"];
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <span className="w-10 shrink-0 text-caption font-bold tabular-nums text-muted">
        {time}
      </span>
      <span
        aria-hidden="true"
        className="h-8 w-[3px] shrink-0 rounded-full bg-tone-dot"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="min-w-0 truncate text-sm font-bold">{title}</span>
        {sub && (
          <span className="min-w-0 truncate text-caption text-muted">
            {sub}
          </span>
        )}
      </span>
      {icon && (
        <span className="shrink-0 text-tone-ink">
          <DomainIcon name={icon} className="h-[18px] w-[18px] shrink-0" />
        </span>
      )}
    </div>
  );
}
