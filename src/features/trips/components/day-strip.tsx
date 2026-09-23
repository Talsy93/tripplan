"use client";

import { Check } from "lucide-react";
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
  // v6 (Stitch): a row of day cards rather than 48px pills — "יום 3" on
  // top, the date large, the weekday under it. The chosen day is the maritime
  // fill; today carries a terracotta dot and the word "היום"; a day already
  // lived gets a check.
  return (
    <div
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {dayNumbers.map((dayNumber) => {
        const isActive = dayNumber === activeDay;
        const isToday = dayNumber === currentDay;
        const isPast = currentDay != null && dayNumber < currentDay;
        const pill = dayPillLabel(startDate, dayNumber);
        return (
          <button
            key={dayNumber}
            type="button"
            onClick={() => onSelect(dayNumber)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "relative flex w-[4.75rem] shrink-0 flex-col items-center gap-0.5 rounded-card px-2 py-2.5 text-caption",
              "transition-[background-color,color,box-shadow,transform] duration-press ease-snap active:scale-[0.96]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-lift"
                : "bg-surface text-muted shadow-card hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1 text-[0.6875rem] font-semibold",
                isActive ? "text-white/85" : "text-muted",
              )}
            >
              {isToday && (
                <span className="h-1.5 w-1.5 rounded-full bg-cta" aria-hidden="true" />
              )}
              {isToday ? "היום" : `יום ${dayNumber}`}
              {isPast && !isActive && (
                <Check className="h-3 w-3 text-success" aria-hidden="true" />
              )}
            </span>
            <span
              className={cn(
                "text-2xl font-bold leading-7 tabular-nums",
                isActive ? "text-white" : "text-foreground",
              )}
            >
              {pill?.dayOfMonth ?? dayNumber}
            </span>
            {/* The weekday, not the word "יום" again: a weekday and a
                day-of-month are how a person finds Saturday in a row. */}
            <span className={cn("text-[0.6875rem]", isActive ? "text-white/80" : "text-muted")}>
              {pill?.weekday ?? " "}
            </span>
          </button>
        );
      })}
    </div>
  );
}
