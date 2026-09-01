import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TwoPane } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  bookingsByDay,
  DayForecastPanel,
  DayPager,
  DayStopsPanel,
  focusDayNumber,
  forecastWindow,
  currentDayNumber,
  daysUntil,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  itineraryStops,
  listBookings,
  lodgingByDay,
  NowCard,
  dateOfDay,
  TodayBefore,
  TodayDuringAside,
  TodayStats,
  todayIn,
  tripOpenItems,
  tripPhase,
  WeatherPanel,
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

  // ---- before departure ---------------------------------------------------
  // A separate branch rather than a screen that conditionally renders four
  // things, because the two states are not the same screen with pieces missing.
  // Before the trip there is no "now" and no current day, so the main column
  // carries what does exist: what is coming, and what is still open. "מה קרוב"
  // moves out of the context pane and into the column — beside an empty column
  // it was the whole screen, in a 372px strip.
  if (!live && !showDay) {
    const open = tripOpenItems({
      startDate: trip.start_date,
      daysUntilStart: trip.start_date ? daysUntil(trip.start_date) : null,
      dayCount,
      cities: routeCities,
      itinerary,
      bookings,
    });

    // The forecast is decided here rather than inside TodayBefore, because
    // "does a forecast exist for these dates" is answerable without a network
    // call and rendering the panel unconditionally would put "התחזית עוד לא
    // קיימת" in the pane of every trip more than 16 days out — a card whose
    // entire content is that it has no content.
    const hasForecast =
      forecastWindow(trip.start_date, trip.end_date, today).kind ===
      "available";

    return (
      <TodayBefore
        tripId={trip.id}
        tripName={trip.name}
        bookings={bookings}
        now={now.toISOString()}
        cities={routeCities}
        open={open}
        forecast={
          hasForecast ? (
            // One request per city, so behind its own boundary: the column
            // beside it must not wait on a forecast.
            <Suspense fallback={<Skeleton className="h-28 rounded-card" />}>
              <WeatherPanel trip={trip} />
            </Suspense>
          ) : undefined
        }
      />
    );
  }

  // ---- on the trip --------------------------------------------------------
  //
  // The pane the mockup draws for this state, in its order: where today's places
  // are, what the weather is doing there, what needs attention, and what it has
  // cost. It carried "מה קרוב" alone until now — one card beside a full column,
  // which is the same imbalance T1 fixed at the other end of the trip.
  const liveCity = live
    ? (live.day.items.find((item) => item.city)?.city ?? null)
    : null;
  // Only the urgent ones. The full list is the before-departure screen's
  // subject; here it is an interruption, and a pane of "worth knowing" rows
  // beside a live day is noise.
  const urgent = live
    ? tripOpenItems({
        startDate: trip.start_date,
        daysUntilStart: trip.start_date ? daysUntil(trip.start_date) : null,
        dayCount,
        cities: routeCities,
        itinerary,
        bookings,
      }).filter((item) => item.urgency === "now")
    : [];

  return (
    <TwoPane
      aside={
        <TodayDuringAside
          tripId={trip.id}
          bookings={bookings}
          now={now.toISOString()}
          cities={routeCities}
          urgent={urgent}
          stops={
            live ? (
              <Suspense fallback={<Skeleton className="h-56 rounded-card" />}>
                <DayStopsPanel
                  tripId={trip.id}
                  tripName={trip.name}
                  day={live.day}
                  city={liveCity}
                />
              </Suspense>
            ) : undefined
          }
          forecast={
            live?.date ? (
              <Suspense fallback={<Skeleton className="h-28 rounded-card" />}>
                <DayForecastPanel
                  tripId={trip.id}
                  tripName={trip.name}
                  city={liveCity}
                  date={live.date}
                />
              </Suspense>
            ) : undefined
          }
        />
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
          tripId={trip.id}
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
