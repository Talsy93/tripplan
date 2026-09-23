import { Clock, Navigation } from "lucide-react";
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

// What you are supposed to be doing, right now.
//
// The one card that owns the fold on the "today" tab. Everything else on that
// screen is a schedule — a thing you read — and this is the thing you act on: it
// is opened while standing on a street, in the sun, and it has to answer in one
// glance. That is why it is the only dark surface on a light screen, and why it
// carries the only two buttons on the fold.
//
// Dark rather than the app's action blue, deliberately. Blue means "press this"
// everywhere else in the app; if the whole card were blue, the two buttons
// inside it would have nothing left to say.
//
// Presentational and server-rendered. `now` is stamped by the page for the same
// reason UpNext takes it: a relative phrase that disagrees between the server
// render and hydration is a bug you only see in production.

function itemTitle(item: DayItem): string {
  if (item.kind === "booking") return item.booking.booking.title;
  if (item.kind === "entry") return item.entry.entry.title;
  return "";
}

function itemWhere(item: DayItem): string | null {
  if (item.kind === "booking") return bookingWhere(item.booking.booking);
  if (item.kind === "entry") return item.entry.entry.note ?? null;
  return null;
}

function itemStart(item: DayItem): number | null {
  if (item.kind === "booking") return item.booking.startMinutes;
  if (item.kind === "entry") return item.entry.startMinutes;
  return null;
}

// What to search for on a map. A booking is best found by its own title plus
// wherever it is; an entry carries its city.
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

export function NowCard({
  day,
  bookings = [],
  date = null,
  now,
}: {
  day: ItineraryDay;
  bookings?: Booking[];
  date?: string | null;
  now: string;
}) {
  const timeline = buildDayTimeline(day, {
    bookings,
    date,
    zone: APP_TIME_ZONE,
  });
  const sequence = daySequence(timeline);

  // The clock, in the trip's zone rather than the reader's — the same rule the
  // booking times follow. instantToWallClock returns YYYY-MM-DDTHH:MM.
  const wall = instantToWallClock(now, APP_TIME_ZONE);
  const [hours, minutes] = wall.slice(11).split(":").map(Number);
  const nowMinutes =
    Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;

  const { current, next, minutesLeft } = dayNow(sequence, nowMinutes);
  const focus = current ?? next;

  // Nothing started and nothing left: the day is over, or has no timed items at
  // all. Either way this card has no answer, and a card with no answer is worse
  // than no card — the schedule below already says everything.
  if (!focus) return null;

  const isNow = current !== null;
  const soon = isEndingSoon(minutesLeft);
  const query = itemQuery(focus);
  const where = itemWhere(focus);
  const start = itemStart(focus);

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

  // v6 (Stitch): the featured card. A lit band on top carries the live badge,
  // the time left and the title in white; the body under it holds the time and
  // the two actions. Stitch draws a photo in the band — this app keeps no place
  // photos, so the band is the concierge gradient with the item's own glyph
  // set large and faint into it.
  return (
    <section
      aria-label={isNow ? "מה עכשיו" : "הבא בתור"}
      className="flex min-w-0 flex-col overflow-hidden rounded-card bg-surface shadow-lift"
    >
      <div className="relative isolate flex min-h-40 flex-col justify-between gap-6 overflow-hidden bg-[image:var(--hero-gradient)] p-4 text-white">
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 -end-4 -z-10 text-white/10">
          {icon ? (
            <DomainIcon name={icon} className="h-40 w-40" />
          ) : (
            <Clock className="h-40 w-40" />
          )}
        </span>

        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-cta px-2.5 py-1 text-caption font-semibold text-cta-foreground shadow-sm">
            {isNow && (
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white" aria-hidden="true" />
            )}
            {isNow ? "עכשיו בלו״ז" : "הבא בתור"}
          </span>

          {leftLabel && (
            <span
              suppressHydrationWarning
              className={
                soon
                  ? "flex shrink-0 items-center gap-1 rounded-full bg-callout-tint px-2.5 py-1 text-caption font-semibold text-callout-ink"
                  : "flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-caption font-semibold text-primary backdrop-blur-md"
              }
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {leftLabel}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          {where && (
            <span className="min-w-0 truncate text-caption font-medium text-white/80">
              {where}
            </span>
          )}
          {/* wrap-anywhere, not truncate: this is the one string on the screen
              the whole card exists to deliver, and half of a restaurant name is
              not an answer. */}
          <h2 className="min-w-0 text-2xl font-semibold leading-tight wrap-anywhere drop-shadow-sm">
            {itemTitle(focus)}
          </h2>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-4">
        {start !== null && (
          <div className="flex min-w-0 items-center gap-1.5 rounded-control bg-surface-2 px-3 py-2 text-caption">
            <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span dir="ltr" className="font-semibold tabular-nums text-foreground">
              {formatMinutes(start)}
            </span>
          </div>
        )}

        <div className="flex min-w-0 items-stretch gap-2">
          {query && (
            <a
              href={googleMapsSearchUrl(query)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control bg-cta px-4 text-sm font-bold text-cta-foreground shadow-md shadow-cta/20 transition-[background-color,transform] duration-press ease-snap hover:bg-cta-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
              ניווט
            </a>
          )}
          {/* An anchor to the rest of the day — the list directly below. Only
              when there is a next and it is not already what this card shows. */}
          {isNow && next && (
            <a
              href="#day-schedule"
              className="flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-control bg-primary-tint px-4 text-sm font-semibold text-primary-ink transition-colors duration-press hover:bg-primary-tint/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              הבא בתור
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
