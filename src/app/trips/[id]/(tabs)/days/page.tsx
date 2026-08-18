import { notFound } from "next/navigation";
import {
  APP_TIME_ZONE,
  cityDayPlan,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  Itinerary,
  listBookings,
  listCityDays,
  lodgingByDay,
  tripDayCount,
} from "@/features/trips";
import type { NightLodging } from "@/features/trips";

export const metadata = { title: 'לו"ז' };

export default async function DaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, itinerary, bookings, selected, overrides] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    listBookings(id),
    getSelectedDestinations(id),
    listCityDays(id),
  ]);
  if (!trip) notFound();

  // Serialised for the client component — a Map does not cross the boundary.
  const lodging: Record<number, NightLodging> = Object.fromEntries(
    lodgingByDay(bookings, trip.start_date, itinerary.length, APP_TIME_ZONE),
  );

  // Cities in the order they were added, which is the order every other surface
  // colours them in. Computed here and not in the client: the derivation counts
  // calendar days in the runtime's zone, and the server's answer has to be the
  // one the AI prompt used — see domain/city-days.ts.
  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);

  return (
    <Itinerary
      tripId={id}
      initialItinerary={itinerary}
      startDate={trip.start_date}
      endDate={trip.end_date}
      lodgingByDay={lodging}
      cityDays={cityDayPlan(cities, bookings, overrides)}
      tripDayCount={tripDayCount(trip.start_date, trip.end_date)}
    />
  );
}
