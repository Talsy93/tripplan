"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { dateOfDay, dayPillLabel } from "../domain/trip-days";

// The month, in Hebrew, for the line under the day of the month ("אוקטובר").
function monthOf(startDate: string | null, dayNumber: number): string | null {
  const date = dateOfDay(startDate, dayNumber);
  if (!date) return null;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("he-IL", {
    month: "long",
    timeZone: "UTC",
  });
}

// The day selector of the Stitch itinerary (v6), drawn to its measurements:
// 80×96 cards, 12px corners, three lines — "יום N" on top, the date in the
// middle, what the day is about at the foot.
//
//   lived     lavender well, no shadow, a filled green check in the corner
//   chosen    the maritime fill, 96px wide, "היום" + a pulsing terracotta dot
//             when it is today, the day number and full date in the middle
//   ahead     white, a small shadow
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
        "-mx-4 overflow-x-auto px-4 pb-0.5 pt-1 [scrollbar-width:none] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div className="flex min-w-max items-center gap-2">
        {dayNumbers.map((dayNumber) => {
          const isActive = dayNumber === activeDay;
          const isToday = dayNumber === currentDay;
          const isPast = currentDay != null && dayNumber < currentDay;
          const pill = dayPillLabel(startDate, dayNumber);
          const month = monthOf(startDate, dayNumber);
          const label = labels?.[dayNumber] ?? pill?.weekday ?? "";

          return (
            <button
              key={dayNumber}
              type="button"
              onClick={() => onSelect(dayNumber)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex h-24 shrink-0 flex-col items-center justify-between rounded-tile p-2 transition-all duration-press ease-snap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "w-24 scale-[1.02] bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : isPast
                    ? "w-20 bg-surface-2 text-muted hover:bg-surface-sunken"
                    : "w-20 bg-surface text-foreground shadow-sm hover:bg-surface-2",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "text-[0.625rem] leading-[0.875rem] font-semibold",
                    isActive ? "font-bold text-primary-tint" : "text-outline",
                  )}
                >
                  {isActive && isToday ? "היום" : `יום ${dayNumber}`}
                </span>
                {isActive && isToday && (
                  <span
                    className="h-2 w-2 animate-pulse rounded-full bg-cta-bright"
                    aria-hidden="true"
                  />
                )}
                {!isActive && isPast && (
                  <CheckCircle2
                    className="h-4 w-4 fill-success text-surface-2"
                    aria-label="יום שעבר"
                  />
                )}
              </span>

              <span className="my-auto flex flex-col items-center">
                <span
                  className={cn(
                    "text-base leading-[1.375rem] font-bold",
                    isActive ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {isActive ? `יום ${dayNumber}` : (pill?.dayOfMonth ?? dayNumber)}
                </span>
                {(month || isActive) && (
                  <span
                    className={cn(
                      "text-[0.625rem] leading-[0.875rem] font-semibold",
                      isActive ? "text-primary-tint" : "text-outline",
                    )}
                  >
                    {isActive
                      ? [pill?.dayOfMonth, month].filter(Boolean).join(" ")
                      : month}
                  </span>
                )}
              </span>

              <span
                className={cn(
                  "w-full truncate text-center text-[0.625rem] leading-[0.875rem] font-semibold",
                  isActive ? "font-medium text-primary-soft" : "text-outline",
                )}
              >
                {label || " "}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
