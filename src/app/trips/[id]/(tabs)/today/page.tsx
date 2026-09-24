import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { TwoPane } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import { instantToWallClock } from "@/lib/datetime";
import {
  APP_TIME_ZONE,
  ArrivalWatcher,
  bookingsByDay,
  DayPanel,
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
  listMembers,
  lodgingByDay,
  NowCard,
  OpenItems,
  dateOfDay,
  TodayGreeting,
  TodayToolbox,
  TonightCard,
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
    members,
    user,
  ] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    getSelectedDestinations(id),
    listBookings(id),
    listDayReminders(id),
    listExpenses(id),
    listDayNotes(id),
    listMembers(id),
    getCurrentUser(),
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
    // So "chosen but not in the schedule" can be noticed. Already read above.
    selectedNames: selected.map((item) => item.name),
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

  // The first name to greet, from the account: Google gives a full name, an
  // email sign-up gives none, and then the greeting goes without one.
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const firstName =
    (meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0] ||
    members.find((member) => member.is_owner)?.member_name?.split(/\s+/)[0] ||
    null;
  const hour = Number(instantToWallClock(nowIso, APP_TIME_ZONE).slice(11, 13));
  const stopCount = live
    ? live.day.items.length + (live.bookings?.length ?? 0)
    : 0;

  // v7 (Pencil): the screen in the design's order — greeting, the "now" card,
  // the location nudge, tonight's bed, the toolbox, the people. The day's full
  // schedule follows at the foot, which is where the card's "הבא" points.
  // PN20 (Pencil): the day's schedule is the pane on a desktop — "המשך היום"
  // beside the now card — and stays at the foot below @4xl, where it always was.
  const schedule = showDay ? (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg leading-6 font-bold text-foreground">הלו״ז של היום</h2>
      <DayPanel
        tripId={trip.id}
        days={itinerary}
        dayNumber={focusDay}
        startDate={trip.start_date}
        currentDay={currentDay}
        bookingsByDay={byDay}
        lodgingByDay={lodging}
        reminders={reminders}
        dayNotes={dayNotes}
        nowIso={phase.kind === "during" ? nowIso : undefined}
      />
    </section>
  ) : undefined;

  return (
    <TwoPane aside={schedule}>
      <h1 className="sr-only">{trip.name}</h1>

      {live && (
        <Suspense fallback={<Skeleton className="h-16 rounded-2xl" />}>
          <TodayGreeting
            tripId={trip.id}
            tripName={trip.name}
            date={live.date}
            city={liveCity}
            firstName={firstName}
            dayNumber={currentDay}
            stopCount={stopCount}
            hour={Number.isFinite(hour) ? hour : 9}
          />
        </Suspense>
      )}

      {live && (
        <NowCard
          day={live.day}
          bookings={live.bookings}
          date={live.date}
          now={nowIso}
        />
      )}

      {/* A tablet has the width for the nudge and tonight's bed side by side;
          auto-fit collapses the empty track when only one of them is there. */}
      <div className="grid gap-5 @2xl:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] @2xl:items-start">
      {live && <ArrivalWatcher tripId={trip.id} day={live.day} />}

      {urgent.length > 0 && (
        <OpenItems tripId={trip.id} items={urgent} title="דורש תשומת לב" />
      )}

      {/* "התחנה הבאה" was its own card here. The Pencil design folds it into
          the "now" card's foot ("הבא: …, 11:30 · 15 דק׳ הליכה"), which says the
          same thing without a second card repeating it underneath. */}

      {live && currentDay !== null && (
        <TonightCard tripId={trip.id} stay={lodging[currentDay] ?? null} />
      )}
      </div>

      {live && currentDay !== null && (
        <Suspense fallback={<Skeleton className="h-40 rounded-[1.25rem]" />}>
          <TodayToolbox
            tripId={trip.id}
            tripName={trip.name}
            city={liveCity}
            dayNumber={currentDay}
            expenses={expenses}
          />
        </Suspense>
      )}

    </TwoPane>
  );
}
