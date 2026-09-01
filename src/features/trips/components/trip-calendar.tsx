"use client";

import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cityToneClass } from "../domain/tone";
import { dateOfDay, dayNumberOfDate } from "../domain/trip-days";
import type { Tone } from "../domain/tone";

// The phone's horizontal day strip, unfolded.
//
// This is the one thing the ימים tab gains from a desktop that a wider strip
// would not give it: a month grid answers "which Saturday" and "how much of the
// month is this trip" in a glance, and the strip answers neither. On a phone
// there is no room for it, which is why the strip exists at all — so this
// appears only in the context pane and the strip stays the control below xl.
//
// A day selector, not a picture. Every in-trip cell is a button that selects
// that day, the same as a pill.
//
// Client, because selecting a day is client state on the tab that owns it.
const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function TripCalendar({
  startDate,
  dayCount,
  activeDay,
  currentDay,
  // City per day number, and the trip's city→tone assignment, so an in-trip
  // cell carries the same tint as that day's rows. The assignment is passed in
  // rather than computed here for the reason domain/tone.ts gives: one city has
  // to be one colour on every surface, and only the caller knows the route
  // order that decides it.
  cityByDay,
  tones,
  onSelect,
}: {
  startDate: string | null;
  dayCount: number;
  activeDay: number;
  currentDay?: number | null;
  cityByDay?: Map<number, string>;
  tones: Map<string, Tone>;
  onSelect: (dayNumber: number) => void;
}) {
  // No dates, no calendar. The strip still works off day numbers alone; this
  // cannot, so it renders nothing rather than a grid of blanks.
  if (!startDate || dayCount < 1) return null;

  const first = dateOfDay(startDate, 1);
  const last = dateOfDay(startDate, dayCount);
  if (!first || !last) return null;

  return (
    <div className="flex flex-col gap-3">
      {monthsBetween(first, last).map((month) => (
        <Card key={month.key} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold">{month.label}</span>
            <span className="text-caption text-muted">
              {month.inTrip} {month.inTrip === 1 ? "יום" : "ימים"} מהטיול
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday}
                aria-hidden="true"
                className="py-0.5 text-center text-caption font-bold text-muted"
              >
                {weekday}
              </span>
            ))}

            {/* Leading blanks so the first of the month lands on its weekday.
                he-IL weeks start on Sunday, which is getUTCDay() === 0, so the
                offset is the day index with no rotation. */}
            {Array.from({ length: month.leading }, (_, i) => (
              <span key={`pad-${i}`} aria-hidden="true" />
            ))}

            {month.days.map((date) => {
              const dayNumber = dayNumberOfDate(startDate, date, dayCount);
              const dayOfMonth = Number(date.slice(8, 10));

              if (dayNumber === null) {
                return (
                  <span
                    key={date}
                    className="py-1.5 text-center text-caption tabular-nums text-border-strong"
                  >
                    {dayOfMonth}
                  </span>
                );
              }

              const isActive = dayNumber === activeDay;
              const isToday = dayNumber === currentDay;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelect(dayNumber)}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`יום ${dayNumber}`}
                  className={cn(
                    "rounded-control py-1.5 text-center text-caption tabular-nums transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    cityToneClass(tones, cityByDay?.get(dayNumber) ?? null),
                    isActive
                      ? // The same ink fill the selected pill gets, for the same
                        // reason: it has to win against whichever of the six
                        // pastels is behind it.
                        "bg-foreground font-black text-surface"
                      : "bg-tone font-bold text-tone-ink hover:brightness-95",
                    isToday && !isActive && "ring-2 ring-primary",
                  )}
                >
                  {dayOfMonth}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

type Month = {
  key: string;
  label: string;
  // Blank cells before the first of the month, so it lands on its weekday.
  leading: number;
  // Every date in the month, in order — including the ones outside the trip,
  // which is what makes it read as a month rather than as a list of trip days.
  days: string[];
  inTrip: number;
};

// Every calendar month the range touches, each as a full month.
//
// Dates are handled as YYYY-MM-DD text and read in UTC throughout, the same way
// the rest of the day arithmetic does it: these are calendar days, not moments,
// and a local-time Date would shift the whole grid by one for half the world.
function monthsBetween(from: string, to: string): Month[] {
  const months: Month[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  const cursor = new Date(`${from}T00:00:00Z`);
  cursor.setUTCDate(1);

  // A trip cannot span more than a handful of months, and the bound is a
  // backstop against a bad end date rather than a real limit.
  for (let guard = 0; guard < 24; guard++) {
    if (cursor.getTime() > end.getTime()) break;

    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();
    const length = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

    const days: string[] = [];
    let inTrip = 0;
    for (let d = 1; d <= length; d++) {
      const date = `${year}-${pad(monthIndex + 1)}-${pad(d)}`;
      days.push(date);
      if (date >= from && date <= to) inTrip++;
    }

    months.push({
      key: `${year}-${pad(monthIndex + 1)}`,
      label: cursor.toLocaleDateString("he-IL", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      leading: new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(),
      days,
      inTrip,
    });

    cursor.setUTCMonth(monthIndex + 1);
  }

  return months;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
