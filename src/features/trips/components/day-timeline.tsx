"use client";

import { ArrowUpDown, Footprints, Map, Navigation, X } from "lucide-react";
import { Card, IconButton, Surface } from "@/components/ui";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/lib/maps";
import { entryDestination } from "../domain/directions";
import {
  axisHours,
  buildDayTimeline,
  distanceLabel,
  durationLabel,
  formatMinutes,
  positionPercent,
} from "../domain/timeline";
import type { ItineraryDay } from "../domain/ai-suggestion";

// One hour of the day, in pixels. Fixed rather than proportional so a long day
// is a taller graphic instead of a denser one — the point of drawing it is
// that an hour looks like an hour.
//
// Phase D made it a CSS variable as well, so the axis breathes on a wide screen
// (--hour-px below) while the entries keep positioning themselves in percent of
// the container and need no change.
const PX_PER_HOUR = 76;

// Below this height a card cannot fit its action row, and the card is
// overflow-hidden — so the links were being drawn and then clipped to a couple
// of visible pixels: present in the DOM, impossible to read or tap. Hiding them
// is the honest version of what was already happening.
//
// The number is the content it has to hold: p-2 top and bottom (16), the title
// row (20), and the link row itself (16). It is measured against the compact
// hour height, so on a wide screen the check is merely conservative.
const MIN_PX_FOR_ACTIONS = 52;

export function DayTimeline({
  day,
  onRemove,
  // Where the day starts from — the lodging that covers this night, already
  // reduced to a string Google can resolve. Null when the night has no booked
  // lodging, and then no directions link is offered: a route from nowhere is
  // not a route.
  origin = null,
}: {
  day: ItineraryDay;
  onRemove?: (entryId: string) => void;
  origin?: string | null;
}) {
  const timeline = buildDayTimeline(day);
  const hours = axisHours(timeline);
  const spanHours = (timeline.endMinutes - timeline.startMinutes) / 60;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative [--hour-px:76px] lg:[--hour-px:92px]"
        style={{ height: `calc(${spanHours} * var(--hour-px))` }}
      >
        {/* Hour gridlines. The gutter sits on the right — this is an RTL
            layout, so the axis reads from the start edge like the text does. */}
        {hours.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${positionPercent(timeline, minute)}%` }}
          >
            <span className="w-10 shrink-0 text-caption tabular-nums text-muted">
              {formatMinutes(minute)}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}

        {/* The entries, positioned over the grid. */}
        <div className="absolute inset-y-0 start-12 end-0">
          {timeline.entries.map(({ entry, startMinutes, endMinutes }) => {
            const top = positionPercent(timeline, startMinutes);
            const bottom = positionPercent(timeline, endMinutes);
            const destination = entryDestination(entry);
            const heightPx = ((endMinutes - startMinutes) / 60) * PX_PER_HOUR;
            const showActions = heightPx >= MIN_PX_FOR_ACTIONS;

            return (
              <Card
                key={entry.id}
                padding="none"
                // The one place in the app that keeps a start-edge stripe. A
                // calendar block is not a list row: here the edge runs the
                // length of the entry and so encodes its duration, which is the
                // whole point of the graphic. Everywhere else the 4px stripe
                // became a dot — see ListRow.
                className="absolute inset-x-0 flex flex-col gap-0.5 overflow-hidden border-s-2 border-s-primary p-2"
                style={{ top: `${top}%`, height: `${bottom - top}%` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {entry.title}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-caption tabular-nums text-muted">
                      {formatMinutes(startMinutes)}–{formatMinutes(endMinutes)}
                    </span>
                    {onRemove && (
                      <IconButton
                        label="הסרה מהלוח"
                        size="sm"
                        variant="danger"
                        className="h-6 w-6"
                        onClick={() => onRemove(entry.id)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                    )}
                  </div>
                </div>
                {entry.note && (
                  <p className="truncate text-caption text-muted">
                    {entry.note}
                  </p>
                )}
                {showActions && (
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption">
                    <a
                      href={googleMapsSearchUrl(
                        entry.city
                          ? `${entry.title} ${entry.city}`
                          : entry.title,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                    >
                      <Map className="h-3.5 w-3.5" aria-hidden="true" />
                      במפה
                    </a>
                    {origin && destination && (
                      <a
                        href={googleMapsDirectionsUrl(origin, destination)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                      >
                        <Navigation
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        איך מגיעים
                      </a>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Gaps between entries. This is the honest version of "transport":
              the time the schedule leaves for getting from one place to the
              next. Actual travel time would need coordinates for every item,
              which only OSM-sourced ones have. */}
          {timeline.transitions.map((transition) => (
            <div
              key={transition.afterId}
              className="absolute inset-x-0 flex items-center justify-center"
              style={{
                top: `${positionPercent(timeline, transition.startMinutes)}%`,
                height: `${
                  positionPercent(
                    timeline,
                    transition.startMinutes + transition.minutes,
                  ) - positionPercent(timeline, transition.startMinutes)
                }%`,
              }}
            >
              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted">
                {transition.walkMinutes !== null ? (
                  <Footprints className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                )}
                {durationLabel(transition.minutes)} מעבר
                {transition.distanceKm !== null && (
                  <> · {distanceLabel(transition.distanceKm)}</>
                )}
                {transition.walkMinutes !== null && (
                  <> · ~{transition.walkMinutes} דקות הליכה</>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {timeline.unscheduled.length > 0 && (
        <Surface tone="sunken" padding="sm" className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold text-muted">
            בלי שעה מוגדרת
          </p>
          <ul className="flex flex-col gap-1">
            {timeline.unscheduled.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-control bg-surface px-2 py-1.5 text-sm"
              >
                <span className="truncate">{entry.title}</span>
                {onRemove && (
                  <IconButton
                    label="הסרה מהלוח"
                    size="sm"
                    variant="danger"
                    className="h-6 w-6"
                    onClick={() => onRemove(entry.id)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}
