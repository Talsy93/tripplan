import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TwoPane } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  ArrivalWatcher,
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
  getShareToken,
  getTrip,
  itineraryStops,
  listBookings,
  listDayReminders,
  listExpenses,
  listGear,
  listMembers,
  listPrepItems,
  lodgingByDay,
  NowCard,
  dateOfDay,
  suggestPrepItems,
  TodayDuringAside,
  TodayPrep,
  TodayStats,
  todayIn,
  tripOpenItems,
  tripPhase,
  WeatherPanel,
} from "@/features/trips";
import type { Booking, NightLodging } from "@/features/trips";

export const metadata = { title: "היום" };

// Two screens under one tab, chosen by the trip's phase:
//
//   before  — the preparations: countdown, the to-do list with suggestions,
//             what the app still finds open, what is coming up.
//   during  — the day: what is happening now, the facts strip (weather, spend,
//             money, bed), the day's timeline with reminders, and the two ways
//             to re-time the day around where you actually are.
export default async function TodayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [itinerary, selected, bookings, reminders, expenses] =
    await Promise.all([
      getItinerary(id),
      getSelectedDestinations(id),
      listBookings(id),
      listDayReminders(id),
      listExpenses(id),
    ]);

  const now = new Date();
  const nowIso = now.toISOString();
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

  const byDay: Record<number, Booking[]> = Object.fromEntries(
    bookingsByDay(bookings, trip.start_date, dayCount, APP_TIME_ZONE),
  );
  const lodging: Record<number, NightLodging> = Object.fromEntries(
    lodgingByDay(bookings, trip.start_date, dayCount, APP_TIME_ZONE),
  );

  const open = tripOpenItems({
    startDate: trip.start_date,
    daysUntilStart: trip.start_date ? daysUntil(trip.start_date) : null,
    dayCount,
    cities: routeCities,
    itinerary,
    bookings,
  });

  const onTheTrip = phase.kind === "during" || phase.kind === "after";
  const showDay = onTheTrip && focusDay !== null;

  const live =
    currentDay !== null && itinerary[currentDay - 1]
      ? {
          day: itinerary[currentDay - 1],
          bookings: byDay[currentDay] ?? [],
          date: dateOfDay(trip.start_date, currentDay),
        }
      : null;

  // --- before the trip: preparations ------------------------------------
  if (!live && !showDay) {
    const [prepItems, shareToken, members, gear] = await Promise.all([
      listPrepItems(id),
      getShareToken(id),
      listMembers(id),
      listGear(id),
    ]);

    const suggestions = suggestPrepItems({
      bookings,
      startDate: trip.start_date,
      existing: prepItems,
      isShared:
        shareToken !== null ||
        members.filter((member) => !member.is_owner).length > 0,
      hasGear: gear.length > 0,
      // Whether this device has push turned on is not known on the server;
      // the suggestion stays and is one tap to dismiss.
      pushEnabled: false,
    });

    const hasForecast =
      forecastWindow(trip.start_date, trip.end_date, today).kind ===
      "available";

    return (
      <TodayPrep
        tripId={trip.id}
        tripName={trip.name}
        startDate={trip.start_date}
        today={today}
        bookings={bookings}
        now={nowIso}
        cities={routeCities}
        open={open}
        prepItems={prepItems}
        suggestions={suggestions}
        forecast={
          hasForecast ? (
            <Suspense fallback={<Skeleton className="h-28 rounded-card" />}>
              <WeatherPanel trip={trip} />
            </Suspense>
          ) : undefined
        }
      />
    );
  }

  // --- during (and after) the trip: the day ------------------------------
  const liveCity = live
    ? (live.day.items.find((item) => item.city)?.city ?? null)
    : null;
  const urgent = live ? open.filter((item) => item.urgency === "now") : [];

  return (
    <TwoPane
      aside={
        <TodayDuringAside
          tripId={trip.id}
          bookings={bookings}
          now={nowIso}
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

      {live && (
        <NowCard
          day={live.day}
          bookings={live.bookings}
          date={live.date}
          now={nowIso}
        />
      )}

      {live && (
        <ArrivalWatcher tripId={trip.id} day={live.day} />
      )}

      {live && (
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[4.75rem] rounded-card" />
              ))}
            </div>
          }
        >
          <TodayStats
            tripId={trip.id}
            tripName={trip.name}
            date={live.date}
            dayNumber={currentDay}
            city={liveCity}
            expenses={expenses}
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
          reminders={reminders}
          nowIso={phase.kind === "during" ? nowIso : undefined}
        />
      ) : null}
    </TwoPane>
  );
}
