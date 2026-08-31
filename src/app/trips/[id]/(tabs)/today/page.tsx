import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TwoPane } from "@/components/layout";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  bookingsByDay,
  DayPager,
  focusDayNumber,
  currentDayNumber,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  itineraryStops,
  listBookings,
  lodgingByDay,
  NowCard,
  dateOfDay,
  TodayStats,
  todayIn,
  tripPhase,
  UpNext,
} from "@/features/trips";
import type { Booking, NightLodging } from "@/features/trips";

export const metadata = { title: "היום" };

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
  const lodging: Record<number, NightLodging> = Object.fromEntries(
    lodgingByDay(bookings, trip.start_date, dayCount, APP_TIME_ZONE),
  );

  const onTheTrip = phase.kind === "during" || phase.kind === "after";
  const showDay = onTheTrip && focusDay !== null;

  // The card only makes sense on the day you are actually living. On day 3 of a
  // trip it answers "what now"; on a trip that starts in three weeks the honest
  // answer is the countdown, which the band above already gives.
  //
  // Resolved as one object rather than three parallel values, so the JSX below
  // needs no non-null assertions to convince the compiler they agree.
  const live =
    currentDay !== null && itinerary[currentDay - 1]
      ? {
          day: itinerary[currentDay - 1],
          bookings: byDay[currentDay] ?? [],
          date: dateOfDay(trip.start_date, currentDay),
        }
      : null;

  return (
    <TwoPane
      // "What is coming" is the thing you glance at and then go straight back to
      // the schedule — two taps on a phone, none beside it. On anything narrower
      // than xl it falls back to where it has always been: below the day.
      aside={
        <section className="flex flex-col gap-3">
          <SectionHeading level="section">מה קרוב</SectionHeading>
          {/* Stamped on the server so "in 3 hours" cannot disagree between the
              server render and hydration. */}
          <UpNext
            bookings={bookings}
            now={now.toISOString()}
            cities={routeCities}
          />
        </section>
      }
    >
      <h1 className="sr-only">{trip.name}</h1>

      {/* Above the pager, because it is the answer and the pager is the
          reference. The two overlap on purpose: this card names one item, and
          the schedule underneath is where you go when that is not what you
          wanted to know. */}
      {live && (
        <NowCard
          day={live.day}
          bookings={live.bookings}
          date={live.date}
          now={now.toISOString()}
        />
      )}

      {live && (
        <Suspense
          fallback={
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[4.75rem] rounded-card" />
              ))}
            </div>
          }
        >
          {/* The only thing on this screen that goes to the network. Behind its
              own boundary so a slow forecast cannot hold up the card above it,
              which is the part someone actually opened the app for. */}
          <TodayStats
            tripId={trip.id}
            tripName={trip.name}
            date={live.date}
            city={live.day.items.find((item) => item.city)?.city ?? null}
            bookings={bookings}
            lodging={currentDay !== null ? (lodging[currentDay] ?? null) : null}
          />
        </Suspense>
      )}

      {showDay ? (
        <DayPager
          days={itinerary}
          initialDay={focusDay}
          startDate={trip.start_date}
          currentDay={currentDay}
          bookingsByDay={byDay}
          lodgingByDay={lodging}
        />
      ) : null}
    </TwoPane>
  );
}
