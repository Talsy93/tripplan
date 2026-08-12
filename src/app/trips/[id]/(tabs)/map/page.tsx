import { notFound } from "next/navigation";
import { getTrip, RouteMapPanel } from "@/features/trips";

// This tab loads none of the trip's other data — RouteMapPanel fetches the
// itinerary and the geocoded route itself. Splitting the tabs into routes is
// what makes that a saving rather than a duplicate.
export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  return <RouteMapPanel tripId={trip.id} tripName={trip.name} />;
}
