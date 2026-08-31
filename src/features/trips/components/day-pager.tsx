"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState, IconButton, Surface, ToneDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cityByDay } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";
import {
  clampDay,
  dateOfDay,
  dayOfTripLabel,
  dayPillLabel,
} from "../domain/trip-days";
import { DayTimeline } from "./day-timeline";
import { NightStay } from "./night-stay";
import type { Booking } from "../domain/booking";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";
import { CalendarDays } from "lucide-react";

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
        icon={<CalendarDays />}
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
      {/* A neutral surface with a tone dot, not a tone-filled panel. Filling a
          full-width header with a pastel is what put six competing colours on
          one screen; the dot says the same thing at a tenth of the volume. */}
      <Surface
        tone="quiet"
        padding="none"
        className="flex items-center justify-between gap-2 px-3 py-3"
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

        <div className="flex min-w-0 flex-col items-center text-center">
          <p className="flex min-w-0 items-center gap-2 text-title font-bold">
            <ToneDot />
            <span className="min-w-0 truncate">{city ?? "הטיול"}</span>
          </p>
          <p className="text-caption font-semibold text-muted">
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
      </Surface>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const isActive = day.day === active.day;
          const isToday = day.day === currentDay;
          const pill = dayPillLabel(startDate, day.day);
          return (
            <button
              key={day.day}
              type="button"
              onClick={() => setDayNumber(day.day)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control text-caption transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  // Ink, not the action blue. Blue means "press this" everywhere
                  // in this app, and a selected day is a state rather than an
                  // invitation — which is the same call the phone's tab bar
                  // already makes for its own selected pill.
                  ? "bg-foreground font-bold text-surface"
                  : "border border-border-strong bg-surface text-muted hover:bg-surface-2 hover:text-foreground",
                // A ring rather than a fill, so "today" and "selected" can be
                // true at once and still be told apart.
                isToday && !isActive && "ring-2 ring-primary",
              )}
            >
              {/* The weekday, not the word "יום". Every pill said the same
                  word, so the only thing telling them apart was a number that
                  means nothing on its own — "יום 9" is not a date anyone holds
                  in their head. A weekday and a day-of-month are how a person
                  actually finds Saturday in a row of pills. Falls back to the
                  old label when the trip has no start date and there is no
                  calendar to reckon by. */}
              <span className="text-caption opacity-70">
                {pill?.weekday ?? "יום"}
              </span>
              <span className="font-bold tabular-nums">
                {pill?.dayOfMonth ?? day.day}
              </span>
            </button>
          );
        })}
      </div>

      {/* The bookings used to be listed here as well as on the timeline
          below. They are the timeline's now — it is the component that knows
          where they sit in the day, and it was rendering the same three facts
          (emoji, title, time) a second time directly underneath.
          The time was also read with getHours(), i.e. the *viewer's* clock,
          while the timeline resolves it in the trip's zone. Two different
          answers for one departure was the real reason to pick one. */}
      <NightStay stay={stayAlreadyListed ? null : stay} />

      {/* Directions run from where you slept, so the timeline can offer a
          route to each of the day's places. */}
      {/* The bookings are listed above as cards already, so the timeline gets
          them only to place them on the axis — `bookings` there also widens
          the axis so an early departure is not clamped to the top edge. */}
      {/* The compact list — this is the screen the design draws it for: a
          reference you glance at after the card above has said what to do.
          scroll-mt clears the sticky app bar when NowCard's "הבא בתור" jumps
          here, so the first row does not land underneath it. */}
      <div id="day-schedule" className="scroll-mt-20">
        <DayTimeline
        day={active}
          variant="compact"
          bookings={bookings}
          date={date}
        />
      </div>
    </div>
  );
}
