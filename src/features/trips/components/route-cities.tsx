"use client";

import { Badge, Card, ToneDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cityToneClass } from "../domain/tone";
import { formatShortDate } from "../domain/trip";
import { dateOfDay } from "../domain/trip-days";
import type { Tone } from "../domain/tone";

export type RouteCity = {
  city: string;
  // The itinerary day numbers spent in this city, in order.
  days: number[];
  nights: number;
};

// The route as a column: which cities, in which order, for how long.
//
// The phone gets this from the chips in the band at the top of every trip
// screen, which say which cities and nothing else. On the ימים tab, where one
// day is on screen at a time, "how long are we in Kyoto and when" is exactly
// the thing the single day cannot answer — so the mockup gives it its own card
// in the context pane.
//
// Each row selects the city's first day, because that is the only thing you
// would want to do from here.
export function RouteCities({
  stops,
  startDate,
  tones,
  activeDay,
  currentDay,
  onSelect,
}: {
  stops: RouteCity[];
  startDate: string | null;
  tones: Map<string, Tone>;
  activeDay: number;
  // Marks the city the trip is in today, not the one being looked at.
  currentDay?: number | null;
  onSelect: (dayNumber: number) => void;
}) {
  if (stops.length === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden">
      <ul>
        {stops.map((stop) => {
          const first = stop.days[0];
          const last = stop.days[stop.days.length - 1];
          if (first === undefined || last === undefined) return null;

          const from = dateOfDay(startDate, first);
          const to = dateOfDay(startDate, last);
          const here =
            currentDay !== undefined && currentDay !== null
              ? stop.days.includes(currentDay)
              : false;
          const looking = stop.days.includes(activeDay);

          return (
            <li
              key={stop.city}
              className={cn(
                "border-b border-border last:border-b-0",
                cityToneClass(tones, stop.city),
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(first)}
                aria-current={looking ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-start transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  looking ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                <ToneDot />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      looking ? "font-bold" : "font-semibold",
                    )}
                  >
                    {stop.city}
                  </span>
                  <span className="block text-caption text-muted">
                    {stop.nights === 0
                      ? "יום אחד"
                      : `${stop.nights} ${stop.nights === 1 ? "לילה" : "לילות"}`}
                    {from &&
                      to &&
                      ` · ${formatShortDate(from)}–${formatShortDate(to)}`}
                  </span>
                </span>
                {/* Only for where the trip actually is. "Where I am looking" is
                    already said by the bold row and the tinted background — a
                    second badge for it would make both mean less. */}
                {here && (
                  <Badge tone="success" className="shrink-0">
                    כאן עכשיו
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// The days with nothing on them, as a row you can act on.
//
// "2 ימים ריקים · 18.09 ו-21.09" is drawn in the mockup as an item with an
// action, not as a statistic, and that is the difference worth keeping: an
// empty day is the one thing on this screen that is unfinished.
export function EmptyDays({
  dayNumbers,
  startDate,
  onSelect,
}: {
  dayNumbers: number[];
  startDate: string | null;
  onSelect: (dayNumber: number) => void;
}) {
  if (dayNumbers.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2">
      <span className="text-sm font-bold">
        {dayNumbers.length === 1
          ? "יום אחד עוד ריק"
          : `${dayNumbers.length} ימים עוד ריקים`}
      </span>
      {/* Buttons and not a sentence: each one goes to the day it names, which is
          the whole point of listing them rather than counting them. */}
      <div className="flex flex-wrap gap-1.5">
        {dayNumbers.map((dayNumber) => {
          const date = dateOfDay(startDate, dayNumber);
          return (
            <button
              key={dayNumber}
              type="button"
              onClick={() => onSelect(dayNumber)}
              className="rounded-full border border-border-strong bg-surface px-2.5 py-1 text-caption font-semibold tabular-nums transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {date ? formatShortDate(date) : `יום ${dayNumber}`}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
