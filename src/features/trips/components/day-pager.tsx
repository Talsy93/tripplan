"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, EmptyState, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BOOKING_KINDS, bookingWhere } from "../domain/booking";
import { lodgingOrigin } from "../domain/directions";
import { cityByDay } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";
import { clampDay, dateOfDay, dayOfTripLabel } from "../domain/trip-days";
import { DayTimeline } from "./day-timeline";
import { NightStay } from "./night-stay";
import type { Booking } from "../domain/booking";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";

// One day at a time, opened on the day you are actually living.
//
// The day is client state rather than a URL param: getItinerary already
// returns the whole trip in one query, so paging costs nothing, while ?day=
// would spend a server round trip on every arrow tap.
export function DayPager({
  days,
  initialDay,
  startDate,
  currentDay,
  bookingsByDay,
  lodgingByDay,
}: {
  days: ItineraryDay[];
  initialDay: number;
  startDate: string | null;
  // The day the calendar says it is, or null outside the trip. Marks "today"
  // in the strip even while looking at another day.
  currentDay: number | null;
  bookingsByDay: Record<number, Booking[]>;
  // Where you sleep on each night, which bookingsByDay cannot tell you: it
  // buckets a booking by its check-in alone, so a five-night hotel appears on
  // one day and nowhere else.
  lodgingByDay: Record<number, NightLodging>;
}) {
  const [dayNumber, setDayNumber] = useState(initialDay);

  const dayCount = days.length;
  const active = days.find((d) => d.day === dayNumber) ?? days[0];
  const tones = cityToneMap([...cityByDay(days).values()]);

  if (!active) {
    return (
      <EmptyState
        icon="🗓️"
        title="עוד אין לו״ז"
        description="בנו לו״ז יומי בטאב ״ימים״, והוא יופיע כאן לפי התאריך."
      />
    );
  }

  const city = [...active.items].reverse().find((it) => it.city)?.city ?? null;
  const date = dateOfDay(startDate, active.day);
  const bookings = bookingsByDay[active.day] ?? [];

  // On the check-in day the booking card above already names the hotel, with
  // its check-in time — repeating it as a "where you sleep" strip would read as
  // the same thing rendered twice.
  const stay = lodgingByDay[active.day] ?? null;
  const stayAlreadyListed = bookings.some(
    (booking) => booking.id === stay?.booking.id,
  );

  const go = (delta: number) =>
    setDayNumber((d) => clampDay(d + delta, dayCount));

  return (
    <div className={cn("flex flex-col gap-4", cityToneClass(tones, city))}>
      <Card
        variant="flat"
        className="flex items-center justify-between gap-2 bg-tone px-3 py-4"
      >
        {/* RTL: "previous" is on the right and its glyph points right. The
            order in the DOM is what decides the sides — do not also mirror. */}
        <IconButton
          label="היום הקודם"
          variant="surface"
          size="sm"
          disabled={active.day <= 1}
          onClick={() => go(-1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </IconButton>

        <div className="min-w-0 text-center text-tone-ink">
          <p className="truncate font-display text-xl">{city ?? "הטיול"}</p>
          <p className="text-xs font-semibold opacity-80">
            {dayOfTripLabel(active.day, dayCount, date)}
          </p>
        </div>

        <IconButton
          label="היום הבא"
          variant="surface"
          size="sm"
          disabled={active.day >= dayCount}
          onClick={() => go(1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Card>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const isActive = day.day === active.day;
          const isToday = day.day === currentDay;
          return (
            <button
              key={day.day}
              type="button"
              onClick={() => setDayNumber(day.day)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control text-xs transition-colors",
                isActive
                  ? "bg-primary font-bold text-primary-foreground"
                  : "border border-border bg-surface text-muted hover:text-foreground",
                // A ring rather than a fill, so "today" and "selected" can be
                // true at once and still be told apart.
                isToday && !isActive && "ring-2 ring-primary",
              )}
            >
              <span className="text-[10px] opacity-70">יום</span>
              <span className="font-bold">{day.day}</span>
            </button>
          );
        })}
      </div>

      {bookings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {bookings.map((booking) => {
            const kind = BOOKING_KINDS[booking.kind];
            const where = bookingWhere(booking);
            const at = new Date(booking.starts_at);
            return (
              <li key={booking.id}>
                <Card className="flex items-center gap-3 border-s-4 border-s-primary p-3">
                  <span className="text-xl leading-none" aria-hidden="true">
                    {kind.emoji}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">
                      {booking.title}
                    </span>
                    {where && (
                      <span className="truncate text-xs text-muted">
                        {where}
                      </span>
                    )}
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-sm font-semibold tabular-nums text-muted"
                  >
                    {String(at.getHours()).padStart(2, "0")}:
                    {String(at.getMinutes()).padStart(2, "0")}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <NightStay stay={stayAlreadyListed ? null : stay} />

      {/* Directions run from where you slept, so the timeline can offer a
          route to each of the day's places. */}
      <DayTimeline
        day={active}
        origin={stay ? lodgingOrigin(stay.booking) : null}
      />
    </div>
  );
}
