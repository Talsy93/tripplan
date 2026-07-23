import { tripStatusLabels, type Trip } from "../domain/trip";

export function TripList({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        עדיין אין טיולים. צרו את הראשון למעלה.
      </p>
    );
  }

  return (
    <ul className="flex w-full max-w-md flex-col gap-2">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
        >
          <span className="font-medium">{trip.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {tripStatusLabels[trip.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
