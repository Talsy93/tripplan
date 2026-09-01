import Link from "next/link";
import { AuraField, Card, EmptyState } from "@/components/ui";
import { NewTripButton } from "./create-trip-form";
import { formatShortDate } from "../domain/trip";
import { phaseLabel, tripPhase } from "../domain/trip-days";
import type { Trip } from "../domain/trip";
import { Luggage } from "lucide-react";

// `today` is passed in rather than read from the clock, so the label cannot
// differ between the server render and hydration.
//
// Both maps are optional: without them the rows render with no light and no
// destination count. The page resolves them, because this component does not
// load data and because the light is assigned across the whole list at once.
export function TripList({
  trips,
  today,
  citiesByTrip,
  auraByTrip,
}: {
  trips: Trip[];
  today: string;
  citiesByTrip?: Map<string, string[]>;
  // Resolved by the page rather than per row, because the palettes are
  // deconflicted across the whole list — a row cannot work out on its own
  // which colours the other rows already took.
  auraByTrip?: Map<string, string[]>;
}) {
  if (trips.length === 0) {
    return (
      <EmptyState
        icon={<Luggage />}
        title="עדיין אין טיולים"
        description="צרו את הראשון ונתחיל לתכנן — יעדים, לוח זמנים והכול."
        action={<NewTripButton />}
      />
    );
  }

  return (
    <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {trips.map((trip) => {
        // Day count is unknown here — the list does not load itineraries. It
        // only matters for a trip with a start date and no end date, which
        // then reads as a single day. Good enough for a badge.
        const phase = tripPhase(trip.start_date, trip.end_date, today, 0);
        const cities = citiesByTrip?.get(trip.id) ?? [];

        return (
          <li key={trip.id} className="min-w-0 animate-rise">
            {/* The stretched link stays even though the delete button that
                forced it is gone: the whole card should be clickable, and an
                after: pseudo-element on the title link is still the way to do
                that without wrapping a card's worth of markup in an <a>. */}
            <Card
              variant="interactive"
              className="relative flex h-full min-w-0 items-center gap-3"
            >
              {/* The trip's light, at 44px — the same hues as its own hero, so a
                  trip is recognisable here by colour before its name is read. No
                  cities means no light: the bare deep base, which is what a trip
                  with nowhere to go should look like.

                  animate={false} is not an oversight: twenty rows each running
                  two infinite animations is the one way this effect gets
                  expensive, and at 44px the drift would not be visible anyway.
                  The blur has to come down with the box — the 42px default is
                  sized for a hero and erases a bloom this small. */}
              <span
                aria-hidden="true"
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-tile"
              >
                <AuraField
                  hues={auraByTrip?.get(trip.id) ?? []}
                  variant="chip"
                  animate={false}
                  blur={11}
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={`/trips/${trip.id}`}
                  className="min-w-0 truncate text-base font-bold after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
                >
                  {trip.name}
                </Link>

                {/* One line, and it replaces both the Badge and the calendar
                    row. The phase is the thing worth knowing at a glance and it
                    was competing with a coloured pill for the same job; the
                    destination count answers "is this trip actually planned
                    yet", which nothing in the row used to say.

                    The end date is not here on purpose — the chip carries the
                    departure, and the full range is on the trip's own page. A
                    two-date range plus a phase plus a count is more than a row
                    in a list can hold without truncating something. */}
                <span className="min-w-0 truncate text-caption text-muted">
                  {phaseLabel(phase)}
                  {cities.length > 0 && ` · ${cities.length} יעדים`}
                </span>
              </div>

              {/* Departure, as a quiet chip rather than a coloured badge: in a
                  list of trips the date is what distinguishes one row from the
                  next, and the phase now reads as words above it. */}
              <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-caption font-bold text-foreground">
                {trip.start_date ? formatShortDate(trip.start_date) : "—"}
              </span>

            </Card>
          </li>
        );
      })}
    </ul>
  );
}
