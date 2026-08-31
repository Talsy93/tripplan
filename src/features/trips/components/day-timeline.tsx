"use client";

import {
  ArrowUpDown,
  Clock,
  Footprints,
  Map as MapIcon,
  MoonStar,
  Navigation,
  Pencil,
  X,
} from "lucide-react";
import { Card, IconButton, Surface } from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/lib/maps";
import { BOOKING_KINDS, bookingWhere } from "../domain/booking";
import { entryDestination } from "../domain/directions";
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
// It was an hour axis: 24 hours of height, with entries positioned into it by
// percentage. That drawing answered "when, proportionally" — and on a 375px
// screen it cost the answer to the only question anyone opens this screen with.
// A day starting at 09:00 put its first real item below eight screens of empty
// grid; a red-eye flight became a 40px sliver in a lane beside it.
//
// What the axis was for is kept rather than dropped: an impossible schedule
// still has to be visible. The gap rows carry that now — "3 שעות" between two
// items says what the empty grid said, in one row instead of a screenful. See
// domain/timeline.ts (daySequence) for the ordering this renders.

export function DayTimeline({
  day,
  onRemove,
  onEdit,
  // Where the day starts from — the lodging that covers this night, already
  // reduced to a string Google can resolve. Null when the night has no booked
  // lodging, and then no directions link is offered: a route from nowhere is
  // not a route.
  origin = null,
  // The day's flights, trains and check-ins. These are the only items here with
  // a real timestamp behind them, so they anchor the day: an activity at 09:00
  // beside a 07:40 departure is visibly impossible, which is the whole reason
  // for showing them together — and they now sit in the same column rather than
  // in a lane of their own, because they are part of the same sequence.
  bookings = [],
  date = null,
}: {
  day: ItineraryDay;
  onRemove?: (entryId: string) => void;
  // Opens the edit dialog for one entry. Optional so the read-only uses of this
  // component (the day pager on the "today" tab) stay read-only.
  onEdit?: (entryId: string) => void;
  origin?: string | null;
  bookings?: Booking[];
  date?: string | null;
}) {
  const timeline = buildDayTimeline(day, {
    bookings,
    date,
    zone: APP_TIME_ZONE,
  });
  const sequence = daySequence(timeline);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {sequence.map((item) => {
        if (item.kind === "gap") {
          return (
            <GapRow
              key={item.key}
              startMinutes={item.startMinutes}
              minutes={item.minutes}
              transition={item.transition}
            />
          );
        }
        if (item.kind === "booking") {
          return <BookingCard key={item.key} placed={item.booking} />;
        }
        return (
          <EntryCard
            key={item.key}
            placed={item.entry}
            origin={origin}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        );
      })}

      {timeline.unscheduled.length > 0 && (
        <Surface tone="sunken" padding="sm" className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold text-muted">
            בלי שעה מוגדרת
          </p>
          <ul className="flex flex-col gap-1">
            {timeline.unscheduled.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-control bg-surface px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{entry.title}</span>
                {onRemove && (
                  <IconButton
                    label="הסרה מהלוח"
                    size="sm"
                    variant="danger"
                    className="h-6 w-6"
                    onClick={() => onRemove(entry.id)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </IconButton>
                )}
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
// this row say the same thing — nothing happens for a while — and only one of
// them fits on a phone.
function GapRow({
  startMinutes,
  minutes,
  transition,
}: {
  startMinutes: number;
  minutes: number;
  transition: Transition | null;
}) {
  const night = isNightGap(startMinutes, minutes);
  const walk = transition?.walkMinutes ?? null;
  const km = transition?.distanceKm ?? null;

  return (
    <div className="flex min-w-0 items-center gap-2 px-1.5 py-0.5">
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

// A time caption, not an axis position. Fixed width so every card in the stack
// starts its title at the same x — the alignment the lane layout used to give,
// and most of why the axis read as orderly at all.
function TimeCell({
  start,
  end,
  continuesNextDay = false,
}: {
  start: number;
  end?: number | null;
  continuesNextDay?: boolean;
}) {
  return (
    <span
      dir="ltr"
      className="w-11 shrink-0 text-start text-caption font-bold tabular-nums text-muted"
    >
      {formatMinutes(start)}
      {continuesNextDay ? (
        <span className="block font-medium">→ מחר</span>
      ) : (
        end != null &&
        end > start && (
          <span className="block font-medium">{formatMinutes(end)}</span>
        )
      )}
    </span>
  );
}

// The coloured spine. Reads --tone-dot from the nearest .tone-* ancestor and
// falls back to muted when there is none, so a day rendered inside a city's
// subtree is colour-coded by city and one rendered bare is simply neutral.
function Spine() {
  return (
    <span
      aria-hidden="true"
      className="w-[3px] shrink-0 self-stretch rounded-full bg-tone-dot"
    />
  );
}

// A booking: paid for, timestamped, and not editable here.
//
// Fuller than an entry, because a ticket is consulted for two things — the code
// and the endpoints — and clipping either was finding 05. `wrap-anywhere`
// rather than `truncate`: a station name with no break opportunity gets a
// second line instead of an ellipsis.
function BookingCard({ placed }: { placed: TimelineBooking }) {
  const { booking, startMinutes, endMinutes, continuesNextDay } = placed;
  const kind = BOOKING_KINDS[booking.kind];
  const where = bookingWhere(booking);

  return (
    <Card padding="none" className="flex min-w-0 items-start gap-3 p-3">
      <TimeCell
        start={startMinutes}
        end={endMinutes}
        continuesNextDay={continuesNextDay}
      />
      <Spine />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 text-sm font-bold wrap-anywhere">
          {booking.title}
        </span>
        {where && (
          <span className="min-w-0 text-caption text-muted wrap-anywhere">
            {where}
          </span>
        )}
        {booking.confirmation && (
          <span className="min-w-0 text-caption text-muted">
            קוד הזמנה{" "}
            <span dir="ltr" className="font-bold text-foreground">
              {booking.confirmation}
            </span>
          </span>
        )}
      </div>
      <span className="shrink-0 pt-0.5 text-muted">
        <DomainIcon name={kind.icon} className="h-[18px] w-[18px] shrink-0" />
        <span className="sr-only">{kind.label}</span>
      </span>
    </Card>
  );
}

function EntryCard({
  placed,
  origin,
  onEdit,
  onRemove,
}: {
  placed: TimelineEntry;
  origin: string | null;
  onEdit?: (entryId: string) => void;
  onRemove?: (entryId: string) => void;
}) {
  const { entry, startMinutes, endMinutes } = placed;
  const destination = entryDestination(entry);

  return (
    <Card padding="none" className="flex min-w-0 items-start gap-3 p-3">
      <TimeCell start={startMinutes} end={endMinutes} />
      <Spine />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 text-sm font-bold wrap-anywhere">
            {entry.title}
          </span>
          {/* Together at the end of the title row rather than floating in the
              card, so every card in the stack puts them in the same place. */}
          {(onEdit || onRemove) && (
            <div className="flex shrink-0 items-center gap-0.5">
              {onEdit && (
                <IconButton
                  label={`עריכת ${entry.title}`}
                  size="sm"
                  className="h-7 w-7"
                  onClick={() => onEdit(entry.id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              )}
              {onRemove && (
                <IconButton
                  label="הסרה מהלוח"
                  size="sm"
                  variant="danger"
                  className="h-7 w-7"
                  onClick={() => onRemove(entry.id)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {entry.note && (
          <p className="min-w-0 text-caption text-muted wrap-anywhere">
            {entry.note}
          </p>
        )}

        {/* Written by hand — knowing you need 25 minutes to get here is the
            reason it was typed in, so it is never the thing that gets dropped. */}
        {(entry.travelNote || entry.travelMinutes !== null) && (
          <p className="flex min-w-0 items-center gap-1 text-caption text-primary-ink">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            {entry.travelMinutes !== null && (
              <span className="shrink-0 font-semibold tabular-nums">
                {entry.travelMinutes} דק׳
              </span>
            )}
            {entry.travelNote && (
              <span className="min-w-0 wrap-anywhere">{entry.travelNote}</span>
            )}
          </p>
        )}

        {/* Always shown now. On the axis these were gated on the block being
            tall enough, because the card was overflow-hidden and a short entry
            clipped them to a few unreadable pixels — a height the card no
            longer has, since it is sized by its content. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption">
          <a
            href={googleMapsSearchUrl(
              entry.city ? `${entry.title} ${entry.city}` : entry.title,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1 font-semibold text-primary-ink hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
            במפה
          </a>
          {origin && destination && (
            <a
              href={googleMapsDirectionsUrl(origin, destination)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 font-semibold text-primary-ink hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              איך מגיעים
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
