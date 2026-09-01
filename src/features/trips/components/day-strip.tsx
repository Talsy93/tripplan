"use client";

import { cn } from "@/lib/cn";
import { dayPillLabel } from "../domain/trip-days";

// The horizontal row of day pills.
//
// Extracted from DayPager in T2, when the ימים tab needed the same row. It was
// the one piece of the day-at-a-time interaction that existed, and it existed on
// exactly one screen — while the tab whose whole subject is the days rendered
// all fourteen of them in sequence.
//
// Presentational and domain-light on purpose: it is handed day numbers and told
// which is selected, so it serves a trip whose itinerary is shorter than its
// dates as easily as one where they match.
export function DayStrip({
  dayNumbers,
  startDate,
  activeDay,
  currentDay,
  onSelect,
  className,
}: {
  dayNumbers: number[];
  startDate: string | null;
  activeDay: number;
  // The day the calendar says it is, or null outside the trip. Marks "today"
  // in the strip even while looking at another day.
  currentDay?: number | null;
  onSelect: (dayNumber: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto pb-1", className)}>
      {dayNumbers.map((dayNumber) => {
        const isActive = dayNumber === activeDay;
        const isToday = dayNumber === currentDay;
        const pill = dayPillLabel(startDate, dayNumber);
        return (
          <button
            key={dayNumber}
            type="button"
            onClick={() => onSelect(dayNumber)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control text-caption transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? // Ink, not the action blue. Blue means "press this" everywhere
                  // in this app, and a selected day is a state rather than an
                  // invitation — which is the same call the phone's tab bar
                  // already makes for its own selected pill.
                  "bg-foreground font-bold text-surface"
                : "border border-border-strong bg-surface text-muted hover:bg-surface-2 hover:text-foreground",
              // A ring rather than a fill, so "today" and "selected" can be
              // true at once and still be told apart.
              isToday && !isActive && "ring-2 ring-primary",
            )}
          >
            {/* The weekday, not the word "יום". Every pill said the same word,
                so the only thing telling them apart was a number that means
                nothing on its own — "יום 9" is not a date anyone holds in their
                head. A weekday and a day-of-month are how a person actually
                finds Saturday in a row of pills. Falls back to the day number
                when the trip has no start date and there is no calendar to
                reckon by. */}
            <span className="text-caption opacity-70">
              {pill?.weekday ?? "יום"}
            </span>
            <span className="font-bold tabular-nums">
              {pill?.dayOfMonth ?? dayNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
}
