import { notFound } from "next/navigation";
import { getPlaceImage } from "@/lib/place-image";
import {
  CountdownHero,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  itineraryStops,
  listBookings,
  UpNext,
} from "@/features/trips";

export default async function TodayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [itinerary, selected, bookings] = await Promise.all([
    getItinerary(id),
    getSelectedDestinations(id),
    listBookings(id),
  ]);

  // Route order comes from the itinerary once one exists, and otherwise from
  // the order cities were added — the same rule every other surface uses, so a
  // city keeps its colour.
  const stops = itineraryStops(itinerary);
  const routeCities =
    stops.length > 0
      ? stops.map((stop) => stop.city)
      : [...new Set(selected.map((item) => item.city).filter(Boolean))];

  const heroImage = await getPlaceImage(routeCities[0] ?? trip.name);

  return (
    <>
      <h1 className="sr-only">{trip.name}</h1>

      <CountdownHero
        tripId={trip.id}
        name={trip.name}
        startDate={trip.start_date}
        imageUrl={heroImage}
        cities={routeCities}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg">מה קרוב</h2>
        {/* Stamped on the server so "in 3 hours" cannot disagree between the
            server render and hydration. */}
        <UpNext
          bookings={bookings}
          now={new Date().toISOString()}
          cities={routeCities}
        />
      </section>
    </>
  );
}
