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

  return (
    <section
      aria-label={isNow ? "מה עכשיו" : "הבא בתור"}
      className="flex min-w-0 flex-col gap-3 rounded-tile bg-aura-veil p-4 text-white shadow-lift sm:p-5"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-extrabold text-white/70">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {isNow ? "עכשיו" : "הבא בתור"}
        </span>

        {/* State as a filled pill, not as coloured text. On a dark surface a
            recoloured word is the first thing to disappear in direct sun, which
            is the lighting this screen is actually used in. */}
        {minutesLeft !== null && (
          <span
            suppressHydrationWarning
            className={
              soon
                ? "shrink-0 rounded-full bg-callout px-2.5 py-0.5 text-caption font-bold text-callout-ink"
                : "shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-caption font-bold text-white/85"
            }
          >
            {isNow
              ? `נגמר בעוד ${durationLabel(Math.max(minutesLeft, 0))}`
              : `בעוד ${durationLabel(Math.max(minutesLeft, 0))}`}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="shrink-0 pt-1 text-white/70">
            <DomainIcon name={icon} className="h-5 w-5 shrink-0" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* wrap-anywhere, not truncate: this is the one string on the screen
              the whole card exists to deliver, and half of a restaurant name is
              not an answer. */}
          <h2 className="min-w-0 text-title font-black wrap-anywhere">
            {itemTitle(focus)}
          </h2>
          <p className="min-w-0 text-caption text-white/70 wrap-anywhere">
            {start !== null && (
              <span dir="ltr" className="tabular-nums">
                {formatMinutes(start)}
              </span>
            )}
            {start !== null && where && " · "}
            {where}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-stretch gap-2 pt-0.5">
        {query && (
          <a
            href={googleMapsSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control bg-white px-4 py-3 text-sm font-bold text-foreground transition-transform duration-press ease-snap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-veil"
          >
            <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
            ניווט
          </a>
        )}
        {/* Only when it is a different thing. While `next` is already the focus
            there is nothing for this to point at. */}
        {isNow && next && (
          <span className="flex min-w-0 flex-1 flex-col justify-center rounded-control border border-white/20 bg-white/10 px-3 py-2">
            <span className="text-caption font-semibold text-white/60">
              אחר כך
            </span>
            <span className="min-w-0 truncate text-sm font-bold">
              {itemTitle(next)}
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
