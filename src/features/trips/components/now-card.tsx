import { Clock, FastForward, Footprints, Map as MapIcon, Navigation, Ticket } from "lucide-react";
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

// "What now" and "what next" on the היום tab, drawn as the Stitch design's
// featured card and its "התחנה הבאה" card under it (v6).
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

// The featured card: a photo band carrying the live badge, the time left and
// the title in white, and a body with the time range and the actions. With no
// photo for the place, the band is the concierge gradient with the item's own
// glyph set large and faint into it.
//
// Returns null when there is nothing to say — the day is over, or empty.
export function NowCard({ day, bookings = [], date = null, now }: DayProps) {
  const { current, next, minutesLeft } = readDay({ day, bookings, date, now });
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

  return (
    <section
      aria-label={isNow ? "מה עכשיו" : "הבא בתור"}
      className="flex min-w-0 flex-col overflow-hidden rounded-card bg-surface shadow-lift"
    >
      <div className="relative isolate h-44 w-full overflow-hidden bg-[image:var(--hero-gradient)] text-white">
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 -end-4 -z-30 text-white/10">
          {icon ? (
            <DomainIcon name={icon} className="h-40 w-40" />
          ) : (
            <Clock className="h-40 w-40" />
          )}
        </span>
        <PlacePhoto
          query={itemTitle(focus)}
          near={itemCity(focus)}
          className="absolute inset-0 -z-20 bg-transparent"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />

        <span className="absolute end-auto start-4 top-4 flex items-center gap-1 rounded-full bg-cta-strong px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold tracking-wide text-white shadow-sm">
          {isNow && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
          )}
          {isNow ? "עכשיו בלו״ז • בלייב" : "הבא בתור"}
        </span>

        {leftLabel && (
          <span
            suppressHydrationWarning
            className={
              soon
                ? "absolute end-4 top-4 flex items-center gap-0.5 rounded-full bg-callout-tint px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-callout-ink shadow-sm"
                : "absolute end-4 top-4 flex items-center gap-0.5 rounded-full bg-surface/90 px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-primary shadow-sm backdrop-blur-md"
            }
          >
            <Clock className="h-[0.9375rem] w-[0.9375rem]" aria-hidden="true" />
            {leftLabel}
          </span>
        )}

        <div className="absolute inset-x-4 bottom-4">
          {where && (
            <span className="block truncate text-[0.625rem] leading-[0.875rem] font-medium text-surface-high">
              {where}
            </span>
          )}
          {/* wrap-anywhere, not truncate: this is the one string on the screen
              the whole card exists to deliver. */}
          <h3 className="mt-0.5 text-2xl leading-tight font-semibold text-white drop-shadow-sm wrap-anywhere">
            {itemTitle(focus)}
          </h3>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 p-4">
        {start !== null && (
          <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-surface-2 p-2 text-xs font-medium text-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-[1.125rem] w-[1.125rem] shrink-0 text-primary" aria-hidden="true" />
              <span dir="ltr" className="font-semibold tabular-nums text-foreground">
                {end !== null && end > start
                  ? `${formatMinutes(start)} - ${formatMinutes(end)}`
                  : formatMinutes(start)}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <Ticket className="h-[1.125rem] w-[1.125rem] shrink-0 text-cta-strong" aria-hidden="true" />
              <span className="min-w-0 truncate text-foreground">{itemKindLabel(focus)}</span>
            </span>
          </div>
        )}

        <div className="flex min-w-0 gap-2">
          {query && (
            <a
              href={googleMapsSearchUrl(query)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-card bg-cta-bright px-4 text-sm font-bold text-cta-deep shadow-md transition-all hover:bg-cta-strong hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Navigation className="h-5 w-5 shrink-0" aria-hidden="true" />
              ניווט למקום
            </a>
          )}
          {/* To the rest of the day, further down this screen. */}
          {isNow && next && (
            <a
              href="#day-schedule"
              className="flex min-h-12 shrink-0 items-center justify-center gap-1 rounded-card bg-primary-tint px-4 text-sm font-semibold text-primary-ink shadow-sm transition-all hover:bg-brand-2 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <FastForward className="h-5 w-5 shrink-0" aria-hidden="true" />
              הבא בתור
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// "התחנה הבאה": the item after the one running, as Stitch's compact card — an
// 80px photo, what it is, the name, how far, and a round map button. Nothing
// when there is no running item (then NowCard is already showing the next one)
// or nothing after it.
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
    <section aria-label="התחנה הבאה" className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-lg leading-6 font-semibold text-foreground">
          <FastForward className="h-5 w-5 text-primary" aria-hidden="true" />
          התחנה הבאה
        </h3>
        {start !== null && (
          <span className="text-[0.625rem] leading-[0.875rem] font-semibold text-cta-strong" suppressHydrationWarning>
            {formatMinutes(start)}
            {start > nowMinutes && ` (עוד ${durationLabel(start - nowMinutes)})`}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-4 rounded-card bg-surface p-4 shadow-card">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-card bg-surface-high text-primary">
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <DomainIcon name={icon} className="h-8 w-8" />
          </span>
          <PlacePhoto
            query={itemTitle(next)}
            near={itemCity(next)}
            className="absolute inset-0 bg-transparent"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.625rem] leading-[0.875rem] font-semibold text-primary">
            {itemKindLabel(next)}
          </span>
          <h4 className="mt-0.5 truncate text-base leading-[1.375rem] font-semibold text-foreground">
            {itemTitle(next)}
          </h4>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
            {walk !== null && (
              <>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Footprints className="h-[0.9375rem] w-[0.9375rem] text-success" aria-hidden="true" />
                  {walk} דק׳
                </span>
                {where && <span>•</span>}
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-primary transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
