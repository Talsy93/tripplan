import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { AuraField, Badge, Card, EmptyState } from "@/components/ui";
import { NewTripButton } from "./create-trip-form";
import { DeleteTripButton } from "./delete-trip-button";
import { formatShortDate } from "../domain/trip";
import { phaseLabel, tripPhase } from "../domain/trip-days";
import type { Trip } from "../domain/trip";

// `today` is passed in rather than read from the clock, so the label cannot
// differ between the server render and hydration.
//
// `auraByTrip` is optional: without it the rows render exactly as before. The
// page resolves it in one query, because a trip's light comes from its cities
// and this component does not load data.
export function TripList({
  trips,
  today,
  auraByTrip,
}: {
  trips: Trip[];
  today: string;
  auraByTrip?: Map<string, string[]>;
}) {
  if (trips.length === 0) {
    return (
      <EmptyState
        icon="🧳"
        title="עדיין אין טיולים"
        description="צרו את הראשון ונתחיל לתכנן — יעדים, לוח זמנים והכול."
        action={<NewTripButton />}
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {trips.map((trip) => {
        // Day count is unknown here — the list does not load itineraries. It
        // only matters for a trip with a start date and no end date, which
        // then reads as a single day. Good enough for a badge.
        const phase = tripPhase(trip.start_date, trip.end_date, today, 0);

        return (
          <li key={trip.id} className="min-w-0">
            {/* The card is not wrapped in the link any more: it holds a delete
                button too, and a <button> inside an <a> is invalid HTML and
                gives a screen reader two controls where there is one link.
                Instead the link carries an after: pseudo-element that covers
                the card, so the whole surface stays clickable while the delete
                button — which sits above it on the z axis — does not. */}
            <Card
              variant="interactive"
              className="relative flex h-full min-w-0 items-center gap-3"
            >
              {/* The trip's light, at 44px — the same hues as its own hero, so a
                  trip is recognisable here by colour before its name is read.
                  Empty hues render as the bare deep base, which is what a trip
                  with no destinations chosen should look like.

                  animate={false} is not an oversight: twenty rows each running
                  two infinite animations is the one way this effect gets
                  expensive, and at 44px the drift would not be visible anyway. */}
              <span
                aria-hidden="true"
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-tile"
              >
                <AuraField
                  hues={auraByTrip?.get(trip.id) ?? []}
                  variant="chip"
                  animate={false}
                  // A quarter of the 44px box. The 42px default is sized for a
                  // hero and blurs a bloom this small out of existence.
                  blur={11}
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/trips/${trip.id}`}
                  className="min-w-0 truncate text-base font-semibold after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
                >
                  {trip.name}
                </Link>
                <span className="flex items-center gap-1.5 text-caption text-muted">
                  {trip.start_date ? (
                    <>
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      {formatShortDate(trip.start_date)}
                      {trip.end_date && ` – ${formatShortDate(trip.end_date)}`}
                    </>
                  ) : (
                    "בלי תאריכים עדיין"
                  )}
                </span>
              </div>

              <Badge tone={phase.kind === "during" ? "success" : "neutral"}>
                {phaseLabel(phase)}
              </Badge>

              <DeleteTripButton tripId={trip.id} tripName={trip.name} />

              {/* RTL: "forward" points left. Decorative — the link above is the
                  affordance, so this must not swallow the click. */}
              <ChevronLeft
                className="pointer-events-none h-5 w-5 shrink-0 text-muted"
                aria-hidden="true"
              />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
