import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { phaseLabel, tripPhase } from "../domain/trip-days";
import type { Trip } from "../domain/trip";

// `today` is passed in rather than read from the clock, so the label cannot
// differ between the server render and hydration.
export function TripList({ trips, today }: { trips: Trip[]; today: string }) {
  if (trips.length === 0) {
    return (
      <p className="text-sm text-muted">
        עדיין אין טיולים. צרו את הראשון ונתחיל לתכנן.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {trips.map((trip) => {
        // Day count is unknown here — the list does not load itineraries. It
        // only matters for a trip with a start date and no end date, which
        // then reads as a single day. Good enough for a badge.
        const phase = tripPhase(trip.start_date, trip.end_date, today, 0);

        return (
          <li key={trip.id}>
            <Link href={`/trips/${trip.id}`} className="block">
              <Card
                variant="interactive"
                className="flex items-center justify-between gap-3 p-4"
              >
                <span className="font-medium">{trip.name}</span>
                <Badge tone={phase.kind === "during" ? "success" : "neutral"}>
                  {phaseLabel(phase)}
                </Badge>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
