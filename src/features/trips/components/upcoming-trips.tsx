import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { AuraField, Card } from "@/components/ui";
import { formatShortDate } from "../domain/trip";
import { standingLabel } from "../domain/trip-order";
import type { StandingTrip } from "../domain/trip-order";

// The middle tier of the home screen: the trips near enough to deserve a row of
// their own, between the hero and the compact grid.
//
// Three tiers rather than two, and the reason is that the screen previously had
// only one size below the hero. Every trip that was not the featured one — the
// one leaving on Sunday and the idea from last year with no dates — was the
// same 44px tile in the same grid. "Sort by which trip is closer and give it
// room" cannot be expressed in a layout with one size; this is the size that
// was missing.
//
// The countdown is the loudest thing on the row on purpose. It is the question
// this screen is opened to answer, and until now it was not on it at all: the
// list showed `phaseLabel` — "לפני היציאה" — which is a state rather than an
// answer. An active trip says which day of it you are on instead, and gets the
// full-strength light and a marked border, because the trip you are standing in
// outranks every trip you are waiting for.
export function UpcomingTrips({
  entries,
  citiesByTrip,
  auraByTrip,
  enterDelayMs = 0,
}: {
  entries: StandingTrip[];
  citiesByTrip?: Map<string, string[]>;
  // Assigned across the whole screen rather than per row, so this row's light
  // matches the same trip's tile in the grid below and its hero above — see
  // domain/aura.ts and the note in profile/page.tsx.
  auraByTrip?: Map<string, string[]>;
  // Where this list's entrance starts. Same contract as TripList: a
  // `--stagger-base` the rows inherit, never an inline animationDelay, which
  // would give every row the same one. See globals.css.
  enterDelayMs?: number;
}) {
  if (entries.length === 0) return null;

  return (
    <ul
      className="stagger flex flex-col gap-3"
      style={
        enterDelayMs > 0
          ? ({ "--stagger-base": `${enterDelayMs}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {entries.map(({ trip, phase }) => {
        const cities = citiesByTrip?.get(trip.id) ?? [];
        const active = phase.kind === "during";

        return (
          <li key={trip.id} className="min-w-0 animate-rise">
            <Card
              variant="interactive"
              className={
                active
                  ? "relative flex min-w-0 items-center gap-4 border-primary/40"
                  : "relative flex min-w-0 items-center gap-4"
              }
            >
              {/* 64px, between the hero's field and the grid's 44px chip — the
                  tier is a size as much as it is a position.

                  animate={false} for the same reason TripList gives: several
                  rows each running two infinite drifts is where this effect
                  starts costing something, and the drift is not legible at this
                  size anyway. The active trip is the exception: there is only
                  ever one of it, and its light moving is most of what marks it
                  out from the rows under it. */}
              <span
                aria-hidden="true"
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-tile"
              >
                <AuraField
                  hues={auraByTrip?.get(trip.id) ?? []}
                  variant="chip"
                  animate={active}
                  blur={16}
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/trips/${trip.id}`}
                  className="min-w-0 truncate text-base font-bold after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
                >
                  {trip.name}
                </Link>

                <span
                  className={
                    active
                      ? "text-sm font-bold text-primary-ink"
                      : "text-sm font-bold text-foreground"
                  }
                >
                  {standingLabel(phase)}
                </span>

                {/* Dates and destinations on one quiet line under the
                    countdown. Both are context for it rather than competing
                    with it, which is why neither is bold and the countdown is.

                    The end date is here, unlike in the compact grid: a row this
                    wide has space for the range, and "how long is it" is the
                    natural next question after "when does it start". */}
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted">
                  {trip.start_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      <span dir="ltr" className="tabular-nums">
                        {formatShortDate(trip.start_date)}
                        {trip.end_date && ` – ${formatShortDate(trip.end_date)}`}
                      </span>
                    </span>
                  )}
                  {cities.length > 0 && (
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        {cities.slice(0, 3).join(" · ")}
                        {cities.length > 3 && ` +${cities.length - 3}`}
                      </span>
                    </span>
                  )}
                </span>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
