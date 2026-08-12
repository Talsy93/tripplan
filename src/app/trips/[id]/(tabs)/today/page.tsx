import { notFound } from "next/navigation";
import { getPlaceImage } from "@/lib/place-image";
import {
  APP_TIME_ZONE,
  bookingsByDay,
  CountdownHero,
  DayPager,
  focusDayNumber,
  currentDayNumber,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  itineraryStops,
  listBookings,
  todayIn,
  tripPhase,
  UpNext,
} from "@/features/trips";
import type { Booking } from "@/features/trips";

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

  // Stamped once, on the server, in one fixed zone. Every date calculation
  // below takes it as an argument and none reads the clock, so the server
  // render and hydration cannot land on different days.
  const now = new Date();
  const today = todayIn(APP_TIME_ZONE, now);

  const dayCount = itinerary.length;
  const phase = tripPhase(trip.start_date, trip.end_date, today, dayCount);
  const focusDay = focusDayNumber(phase, dayCount);
  const currentDay = currentDayNumber(trip.start_date, today, dayCount);

  const stops = itineraryStops(itinerary);
  const routeCities =
    stops.length > 0
      ? stops.map((stop) => stop.city)
      : [...new Set(selected.map((item) => item.city).filter(Boolean))];

  // Serialised for the client component — a Map does not cross the boundary.
  const byDay: Record<number, Booking[]> = Object.fromEntries(
    bookingsByDay(bookings, trip.start_date, dayCount, APP_TIME_ZONE),
  );

  const onTheTrip = phase.kind === "during" || phase.kind === "after";
  const showDay = onTheTrip && focusDay !== null;

  return (
    <>
      <h1 className="sr-only">{trip.name}</h1>

      {showDay ? (
        <DayPager
          days={itinerary}
          initialDay={focusDay}
          startDate={trip.start_date}
          currentDay={currentDay}
          bookingsByDay={byDay}
        />
      ) : (
        <CountdownHero
          tripId={trip.id}
          name={trip.name}
          startDate={trip.start_date}
          imageUrl={await getPlaceImage(routeCities[0] ?? trip.name)}
          cities={routeCities}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg">מה קרוב</h2>
        {/* Stamped on the server so "in 3 hours" cannot disagree between the
            server render and hydration. */}
        <UpNext
          bookings={bookings}
          now={now.toISOString()}
          cities={routeCities}
        />
      </section>
    </>
  );
}
