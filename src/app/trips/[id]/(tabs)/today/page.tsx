import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
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
  currentDayNumber,
  daysUntil,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  itineraryStops,
  listBookings,
  listDayNotes,
  listDayReminders,
  listExpenses,
  lodgingByDay,
  NowCard,
  dateOfDay,
  TodayDuringAside,
  TodayStats,
  todayIn,
  tripOpenItems,
  tripPhase,
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

  // One wave, not three.
  //
  // This page used to read the trip, then its five day-reads, then — on the
  // preparations screen — four more: three round trips to Frankfurt stacked
  // back to back, which is most of what a tab switch was waiting for. Every
  // read this page needs now goes out together and costs one.
  //
  // Four of them are gone outright. Prep items, the share token, the members
  // and the gear were read here only to decide what the *preparations* screen
  // should suggest — and they had to be asked for unconditionally, because
  // which screen this is cannot be known until the itinerary is back. That
  // screen has moved to /more/gear, so the tab that is opened most often no
  // longer pays four indexed reads for a branch it does not take.
  const [
    trip,
    itinerary,
    selected,
    bookings,
    reminders,
    expenses,
    dayNotes,
  ] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    getSelectedDestinations(id),
    listBookings(id),
    listDayReminders(id),
    listExpenses(id),
    listDayNotes(id),
  ]);
  if (!trip) notFound();

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

  // --- before the trip: there is no "today" -------------------------------
  //
  // This branch used to render the preparations screen. It does not any more:
  // that screen and the packing list were the same page written twice, so they
  // were merged at /more/gear and the tab is not drawn before the trip starts
  // (see TRIP_TABS).
  //
  // A redirect and not a 404, because the route is still reachable — the rail
  // shortcut, a bookmark, a link someone was sent — and landing on "not found"
  // for a tab that existed yesterday is the worse answer.
  if (!live && !showDay) {
    redirect(`/trips/${id}/more/gear`);
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
          dayNotes={dayNotes}
          nowIso={phase.kind === "during" ? nowIso : undefined}
        />
      ) : null}
    </TwoPane>
  );
}
