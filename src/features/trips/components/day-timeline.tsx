"use client";

import { Card } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
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
const PX_PER_HOUR = 76;

export function DayTimeline({
  day,
  onRemove,
}: {
  day: ItineraryDay;
  onRemove?: (entryId: string) => void;
}) {
  const timeline = buildDayTimeline(day);
  const hours = axisHours(timeline);
  const height =
    ((timeline.endMinutes - timeline.startMinutes) / 60) * PX_PER_HOUR;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" style={{ height }}>
        {/* Hour gridlines. The gutter sits on the right — this is an RTL
            layout, so the axis reads from the start edge like the text does. */}
        {hours.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${positionPercent(timeline, minute)}%` }}
          >
            <span className="w-10 shrink-0 text-xs tabular-nums text-muted">
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

            return (
              <Card
                key={entry.id}
                className="absolute inset-x-0 flex flex-col gap-0.5 overflow-hidden border-s-4 border-s-primary p-2"
                style={{ top: `${top}%`, height: `${bottom - top}%` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {entry.title}
                  </span>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="text-xs tabular-nums text-muted">
                      {formatMinutes(startMinutes)}–{formatMinutes(endMinutes)}
                    </span>
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(entry.id)}
                        aria-label="הסר מהלו״ז"
                        className="text-muted transition-colors hover:text-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {entry.note && (
                  <p className="truncate text-xs text-muted">{entry.note}</p>
                )}
                <a
                  href={googleMapsSearchUrl(
                    entry.city ? `${entry.title} ${entry.city}` : entry.title,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto self-start text-xs text-primary hover:underline"
                >
                  🗺️ במפה
                </a>
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
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {transition.walkMinutes !== null ? "🚶" : "↕"}{" "}
                {durationLabel(transition.minutes)} מעבר
                {transition.distanceKm !== null && (
                  <> · {distanceLabel(transition.distanceKm)}</>
                )}
                {transition.walkMinutes !== null && (
                  <> · ~{transition.walkMinutes} דק׳ הליכה</>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {timeline.unscheduled.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">בלי שעה מוגדרת:</p>
          <ul className="flex flex-col gap-1">
            {timeline.unscheduled.map((entry) => (
              <li key={entry.id}>
                <Card className="flex items-center justify-between gap-2 p-2 text-sm">
                  <span className="truncate">{entry.title}</span>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      aria-label="הסר מהלו״ז"
                      className="shrink-0 text-muted transition-colors hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
