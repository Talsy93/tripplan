import { notFound } from "next/navigation";
import { getItinerary, getTrip, Itinerary } from "@/features/trips";

export default async function DaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, itinerary] = await Promise.all([getTrip(id), getItinerary(id)]);
  if (!trip) notFound();

  return (
    <Itinerary
      tripId={id}
      initialItinerary={itinerary}
      startDate={trip.start_date}
      endDate={trip.end_date}
    />
  );
}
