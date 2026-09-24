import { Clock, Footprints, Map as MapIcon, Navigation } from "lucide-react";
import { instantToWallClock } from "@/lib/datetime";
import { googleMapsSearchUrl } from "@/lib/maps";
import { BOOKING_KINDS, bookingWhere } from "../domain/booking";
import { APP_TIME_ZONE } from "../domain/weather";
import {
  buildDayTimeline,
  dayNow,
  daySequence,
  durationLabel,
  formatMinutes,
  isEndingSoon,
} from "../domain/timeline";
import type { Booking } from "../domain/booking";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { DayItem } from "../domain/timeline";
import { DomainIcon } from "./domain-icon";
import { PlacePhoto } from "./place-photo";

// "What now" and "what next" on the היום tab, drawn as the Pencil design's
// featured card and its "התחנה הבאה" card (v7).
//
// Both read the same day through the same functions, so they cannot disagree
// about which item is running: the timeline, then its sequence, then dayNow.

function itemTitle(item: DayItem): string {
  if (item.kind === "booking") return item.booking.booking.title;
  if (item.kind === "entry") return item.entry.entry.title;
  return "";
}

function itemWhere(item: DayItem): string | null {
  if (item.kind === "booking") return bookingWhere(item.booking.booking);
  if (item.kind === "entry") return item.entry.entry.note?.split("\n")[0] ?? null;
  return null;
}

function itemCity(item: DayItem): string | null {
  if (item.kind === "booking") return item.booking.booking.city;
  if (item.kind === "entry") return item.entry.entry.city ?? null;
  return null;
}

function itemStart(item: DayItem): number | null {
  if (item.kind === "booking") return item.booking.startMinutes;
  if (item.kind === "entry") return item.entry.startMinutes;
  return null;
}

function itemEnd(item: DayItem): number | null {
  if (item.kind === "booking") return item.booking.endMinutes;
  if (item.kind === "entry") return item.entry.endMinutes;
  return null;
}

// What the item is, for the small line over its title.
function itemKindLabel(item: DayItem): string {
  if (item.kind === "booking") return BOOKING_KINDS[item.booking.booking.kind].label;
  if (item.kind === "entry" && item.entry.entry.fixed) return "מתוכנן מראש";
  return "בלו״ז היום";
}

function itemQuery(item: DayItem): string | null {
  if (item.kind === "entry") {
    const entry = item.entry.entry;
    return entry.city ? `${entry.title} ${entry.city}` : entry.title;
  }
  if (item.kind === "booking") {
    const booking = item.booking.booking;
    return booking.address ?? booking.destination ?? booking.title;
  }
  return null;
}

function readDay({
  day,
  bookings,
  date,
  now,
}: {
  day: ItineraryDay;
  bookings: Booking[];
  date: string | null;
  now: string;
}) {
  const timeline = buildDayTimeline(day, {
    bookings,
    date,
    zone: APP_TIME_ZONE,
  });
  const sequence = daySequence(timeline);

  // The wall clock where the trip is, as minutes since midnight — the unit
  // the timeline speaks.
  const wall = instantToWallClock(now, APP_TIME_ZONE);
  const [hours, minutes] = wall.slice(11).split(":").map(Number);
  const nowMinutes =
    Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;

  return { ...dayNow(sequence, nowMinutes), nowMinutes };
}

type DayProps = {
  day: ItineraryDay;
  bookings?: Booking[];
  date?: string | null;
  // Stamped by the server, so both renders agree on what "now" is.
  now: string;
};

// The featured card (Pencil, v7): the one gradient on the screen. A live dot
// and "עכשיו", when it ends, the place in large type, how long is left and a
// bar for how much of it has gone, then what comes after it beside a white
// "ניווט" pill.
//
// A photo of the place, when there is one, sits under the teal as a texture —
// the card reads the same with or without it. With no photo the item's own
// glyph is set large and faint into the corner.
//
// Returns null when there is nothing to say — the day is over, or empty.
export function NowCard({ day, bookings = [], date = null, now }: DayProps) {
  const { current, next, minutesLeft, nowMinutes } = readDay({ day, bookings, date, now });
  const focus = current ?? next;
  if (!focus) return null;

  const isNow = current !== null;
  const soon = isEndingSoon(minutesLeft);
  const query = itemQuery(focus);
  const where = itemWhere(focus);
  const start = itemStart(focus);
  const end = itemEnd(focus);

  const icon =
    focus.kind === "booking"
      ? BOOKING_KINDS[focus.booking.booking.kind].icon
      : null;

  const leftLabel =
    minutesLeft === null
      ? null
      : isNow
        ? `נשארו ${durationLabel(Math.max(minutesLeft, 0))}`
        : `בעוד ${durationLabel(Math.max(minutesLeft, 0))}`;

  // How much of the item has gone by, for the bar. Only while it is running
  // and has an end — an open-ended item has no "how much".
  const progress =
    isNow && start !== null && end !== null && end > start
      ? Math.min(Math.max((nowMinutes - start) / (end - start), 0), 1)
      : null;

  // What comes after the running item, at the card's foot. Between items the
  // card is already about the next one, so there is nothing to add.
  const after = isNow ? next : null;
  const afterStart = after ? itemStart(after) : null;
  const afterWalk =
    after?.kind === "entry" && after.entry.entry.travelMinutes !== null
      ? after.entry.entry.travelMinutes
      : null;

  return (
    <section
      aria-label={isNow ? "מה עכשיו" : "הבא בתור"}
      className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] bg-[image:var(--hero-gradient)] p-5 text-white shadow-lift"
    >
      <PlacePhoto
        query={itemTitle(focus)}
        near={itemCity(focus)}
        className="absolute inset-0 -z-20 bg-transparent"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[image:var(--hero-gradient)] opacity-[0.88]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-8 -end-6 -z-10 text-white/[0.07]">
        {icon ? (
          <DomainIcon name={icon} className="h-40 w-40" />
        ) : (
          <Clock className="h-40 w-40" />
        )}
      </span>

      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
          <span
            aria-hidden="true"
            className={isNow ? "h-2 w-2 animate-pulse rounded-full bg-success-bright" : "h-2 w-2 rounded-full bg-white/60"}
          />
          {isNow ? "עכשיו" : "הבא בתור"}
        </span>
        {isNow && end !== null ? (
          <span className="text-sm font-semibold text-white/85 tabular-nums">
            עד {formatMinutes(end)}
          </span>
        ) : !isNow && start !== null ? (
          <span className="text-sm font-semibold text-white/85 tabular-nums">
            ב-{formatMinutes(start)}
          </span>
        ) : null}
      </div>

      {where && (
        <span className="mt-4 block truncate text-xs text-white/70">{where}</span>
      )}
      {/* wrap-anywhere, not truncate: this is the one string on the screen
          the whole card exists to deliver. */}
      <h3 className={`${where ? "mt-0.5" : "mt-4"} text-[1.75rem] leading-9 font-bold wrap-anywhere`}>
        {itemTitle(focus)}
      </h3>
      {leftLabel && (
        <p suppressHydrationWarning className="mt-1 text-sm">
          {soon ? (
            <span className="rounded-full bg-cta-bright px-2 py-0.5 font-semibold text-white">
              {leftLabel}
            </span>
          ) : (
            <span className="text-white/80">{leftLabel}</span>
          )}
        </p>
      )}

      {progress !== null && (
        <div
          role="progressbar"
          aria-label="כמה עבר"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/25"
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="mt-5 flex min-w-0 items-center justify-between gap-3">
        {after ? (
          // To the rest of the day, further down this screen.
          <a
            href="#day-schedule"
            className="flex min-w-0 flex-1 flex-col rounded-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="truncate text-sm font-semibold">
              הבא: {itemTitle(after)}
            </span>
            <span className="flex min-w-0 items-center gap-1 text-xs text-white/70 tabular-nums">
              {afterStart !== null && formatMinutes(afterStart)}
              {afterStart !== null && afterWalk !== null && " · "}
              {afterWalk !== null && (
                <>
                  <Footprints className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {afterWalk} דק׳ הליכה
                </>
              )}
            </span>
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-white/70">
            {start !== null && (
              <span dir="ltr" className="tabular-nums">
                {end !== null && end > start
                  ? `${formatMinutes(start)} - ${formatMinutes(end)}`
                  : formatMinutes(start)}
              </span>
            )}
            {start !== null && " · "}
            {itemKindLabel(focus)}
          </span>
        )}
        {query && (
          <a
            href={googleMapsSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface px-5 text-sm font-bold text-primary shadow-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
            ניווט
          </a>
        )}
      </div>
    </section>
  );
}

// "התחנה הבאה": the item after the one running, as a compact white card — a
// photo or the item's glyph on a teal tile, what it is, the name, how far, and
// a round map button. Nothing when there is no running item (then NowCard is
// already showing the next one) or nothing after it.
//
// The day screen folds this into NowCard's foot now, as the Pencil design
// does; the card stays for layouts that want it on its own.
export function NextStopCard({ day, bookings = [], date = null, now }: DayProps) {
  const { current, next, nowMinutes } = readDay({ day, bookings, date, now });
  if (!current || !next) return null;

  const start = itemStart(next);
  const query = itemQuery(next);
  const where = itemWhere(next);
  const walk =
    next.kind === "entry" && next.entry.entry.travelMinutes !== null
      ? next.entry.entry.travelMinutes
      : null;
  const icon =
    next.kind === "booking" ? BOOKING_KINDS[next.booking.booking.kind].icon : "attraction";

  return (
    <section aria-label="התחנה הבאה" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg leading-6 font-bold text-foreground">התחנה הבאה</h3>
        {start !== null && (
          <span className="text-xs font-semibold text-muted tabular-nums" suppressHydrationWarning>
            {formatMinutes(start)}
            {start > nowMinutes && ` · עוד ${durationLabel(start - nowMinutes)}`}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-surface p-3.5 shadow-card">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-primary-tint text-primary">
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <DomainIcon name={icon} className="h-7 w-7" />
          </span>
          <PlacePhoto
            query={itemTitle(next)}
            near={itemCity(next)}
            className="absolute inset-0 bg-transparent"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted">{itemKindLabel(next)}</span>
          <h4 className="truncate text-base leading-6 font-bold text-foreground">
            {itemTitle(next)}
          </h4>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            {walk !== null && (
              <>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
                  {walk} דק׳
                </span>
                {where && <span aria-hidden="true">·</span>}
              </>
            )}
            {where && <span className="truncate">{where}</span>}
          </div>
        </div>
        {query && (
          <a
            href={googleMapsSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${itemTitle(next)} במפה`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
