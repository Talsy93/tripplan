import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  daysUntil,
  forecastWindow,
  getSelectedDestinations,
  getItinerary,
  getTrip,
  itineraryStops,
  listBookings,
  listPrepItems,
  MoreBackLink,
  todayIn,
  TodayPrep,
  tripOpenItems,
  WeatherPanel,
} from "@/features/trips";

export const metadata = { title: "לפני היציאה" };

// Before the trip: the countdown, what is still open, what is coming up.
//
// The packing list and the reminders were on this page too, and moved to the
// documents tab as the one checklist the Stitch export draws (2026-09-23).
//
// They were two: this page held the packing list, and the "היום" tab — before
// the trip started — held a countdown, the prep checklist and what was still
// open. Reported as exactly the duplication it was, so the two became one and
// the "היום" tab now waits for a today to exist (see TRIP_TABS). /today
// redirects here in the meantime, so nothing that pointed at it breaks.
//
// The reads are the wave the "היום" tab used to make, minus the ones only the
// during-trip screen needs. They go out together and cost one round trip.
export default async function ListsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [trip, itinerary, selected, bookings, prepItems] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    getSelectedDestinations(id),
    listBookings(id),
    listPrepItems(id),
  ]);
  if (!trip) notFound();

  const now = new Date();
  const today = todayIn(APP_TIME_ZONE, now);
  const dayCount = itinerary.length;

  const stops = itineraryStops(itinerary);
  const cities =
    stops.length > 0
      ? stops.map((stop) => stop.city)
      : [...new Set(selected.map((item) => item.city).filter(Boolean))];

  const open = tripOpenItems({
    startDate: trip.start_date,
    daysUntilStart: trip.start_date ? daysUntil(trip.start_date) : null,
    dayCount,
    cities,
    itinerary,
    bookings,
    // So "chosen but not in the schedule" can be noticed. Already read above.
    selectedNames: selected.map((item) => item.name),
  });

  const hasForecast =
    forecastWindow(trip.start_date, trip.end_date, today).kind === "available";

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="כמה זמן נשאר, מה עוד פתוח בתכנון, ומה מתקרב. רשימת הציוד והתזכורות נמצאת בטאב ״מסמכים״."
      >
        לפני היציאה
      </SectionHeading>

      <TodayPrep
        tripId={trip.id}
        tripName={trip.name}
        startDate={trip.start_date}
        today={today}
        bookings={bookings}
        now={now.toISOString()}
        cities={cities}
        open={open}
        prepItems={prepItems}
        forecast={
          hasForecast ? (
            <Suspense fallback={<Skeleton className="h-28 rounded-card" />}>
              <WeatherPanel trip={trip} />
            </Suspense>
          ) : undefined
        }
      />
    </>
  );
}
