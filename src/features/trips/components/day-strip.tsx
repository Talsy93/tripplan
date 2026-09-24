"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { dayPillLabel } from "../domain/trip-days";

// The day selector, drawn to the Pencil route screen (phase PN): 60×78 pills
// with 18px corners and three lines — the weekday small on top, the day number
// big in the middle, the day's city small at the foot.
//
//   lived     white, a green check where the weekday was — the day is done,
//             and "which weekday was it" stopped mattering
//   chosen    the ink fill with white text. Ink rather than teal because teal
//             is the tab bar's selection, and two teal selections stacked on
//             one screen read as one control
//   ahead     white on the canvas, the card shadow
//
// Today keeps a small terracotta dot beside its weekday, so "where am I in
// the trip" survives choosing some other day to look at.
export function DayStrip({
  dayNumbers,
  startDate,
  activeDay,
  currentDay,
  onSelect,
  labels,
  className,
}: {
  dayNumbers: number[];
  startDate: string | null;
  activeDay: number;
  currentDay?: number | null;
  onSelect: (dayNumber: number) => void;
  // What each day is about — its city, or its first stop — for the foot line.
  labels?: Record<number, string | null | undefined>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div className="flex min-w-max items-stretch gap-2">
        {dayNumbers.map((dayNumber) => {
          const isActive = dayNumber === activeDay;
          const isToday = dayNumber === currentDay;
          const isPast = currentDay != null && dayNumber < currentDay;
          const pill = dayPillLabel(startDate, dayNumber);
          const label = labels?.[dayNumber] ?? "";

          return (
            <button
              key={dayNumber}
              type="button"
              onClick={() => onSelect(dayNumber)}
              aria-current={isActive ? "true" : undefined}
              aria-label={[
                `יום ${dayNumber}`,
                pill?.weekday,
                label,
                isToday ? "היום" : null,
                isPast ? "עבר" : null,
              ]
                .filter(Boolean)
                .join(", ")}
              className={cn(
                "flex h-[78px] w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1",
                "transition-[background-color,box-shadow,transform] duration-press ease-snap active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-foreground text-surface shadow-lift"
                  : "bg-surface text-foreground shadow-card hover:shadow-lift",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 items-center gap-1 text-[0.6875rem] leading-none font-medium",
                  isActive ? "text-surface/70" : "text-muted",
                )}
                aria-hidden="true"
              >
                {isPast && !isActive ? (
                  <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
                ) : (
                  (pill?.weekday ?? "")
                )}
                {isToday && (
                  <span className="h-1.5 w-1.5 rounded-full bg-cta" />
                )}
              </span>
              <span
                className="text-[1.375rem] leading-7 font-bold tabular-nums"
                aria-hidden="true"
              >
                {dayNumber}
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[0.625rem] leading-3 font-medium",
                  isActive ? "text-surface/80" : "text-muted",
                )}
                aria-hidden="true"
              >
                {label || pill?.dayOfMonth || " "}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
