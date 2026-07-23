import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { tripStatusLabels, type Trip } from "../domain/trip";

export function TripList({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) {
    return (
      <p className="text-sm text-muted">עדיין אין טיולים. צרו את הראשון למעלה.</p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {trips.map((trip) => (
        <li key={trip.id}>
          <Link href={`/trips/${trip.id}`} className="block">
            <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary">
              <span className="font-medium">{trip.name}</span>
              <Badge>{tripStatusLabels[trip.status]}</Badge>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
