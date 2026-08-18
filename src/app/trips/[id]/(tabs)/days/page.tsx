import { notFound } from "next/navigation";
import {
  APP_TIME_ZONE,
  getItinerary,
  getTrip,
  Itinerary,
  listBookings,
  lodgingByDay,
} from "@/features/trips";
import type { NightLodging } from "@/features/trips";

export const metadata = { title: "לו\"ז" };

export default async function DaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, itinerary, bookings] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    listBookings(id),
  ]);
  if (!trip) notFound();

  // Serialised for the client component — a Map does not cross the boundary.
  const lodging: Record<number, NightLodging> = Object.fromEntries(
    lodgingByDay(bookings, trip.start_date, itinerary.length, APP_TIME_ZONE),
  );

  return (
    <Itinerary
      tripId={id}
      initialItinerary={itinerary}
      startDate={trip.start_date}
      endDate={trip.end_date}
      lodgingByDay={lodging}
    />
  );
}
