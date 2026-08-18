import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { NewTripButton } from "./create-trip-form";
import { formatShortDate } from "../domain/trip";
import { phaseLabel, tripPhase } from "../domain/trip-days";
import type { Trip } from "../domain/trip";

// `today` is passed in rather than read from the clock, so the label cannot
// differ between the server render and hydration.
export function TripList({ trips, today }: { trips: Trip[]; today: string }) {
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
          <li key={trip.id}>
            <Link
              href={`/trips/${trip.id}`}
              className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card
                variant="interactive"
                className="flex h-full items-center gap-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-base font-semibold">
                    {trip.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-caption text-muted">
                    {trip.start_date ? (
                      <>
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
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
                {/* RTL: "forward" points left. */}
                <ChevronLeft
                  className="h-5 w-5 shrink-0 text-muted"
                  aria-hidden="true"
                />
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
