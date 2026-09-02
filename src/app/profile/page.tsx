import { AppHeader, AppShell, TwoPane } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  APP_TIME_ZONE,
  assignTripAuras,
  AuraHero,
  daysUntil,
  HomeRail,
  HowItWorks,
  NewTripButton,
  getItinerary,
  getItineraryDayCountByTrip,
  getSelectedCitiesByTrip,
  getSelectedDestinations,
  itineraryStops,
  listBookings,
  listTrips,
  OpenItems,
  orderTripsByProximity,
  pickFeaturedTrip,
  StartHere,
  todayIn,
  tripOpenItems,
  tripPhase,
  TripList,
  UpcomingTrips,
  UpNext,
} from "@/features/trips";
import type { Booking, OpenItem } from "@/features/trips";

export const metadata = { title: "הטיולים שלי · MyTrip" };

export default async function ProfilePage() {
  const [user, trips, citiesByTrip, dayCounts] = await Promise.all([
    getCurrentUser(),
    listTrips(),
    // One query for every trip's cities, which is what each trip's light is
    // derived from. Per-row it would have been one round trip per trip.
    getSelectedCitiesByTrip(),
    // And one for every trip's length. Ordering the screen by proximity means
    // asking each trip where it stands, and a trip with a start date and no end
    // date cannot answer that without knowing how long its itinerary runs — it
    // would read as finished the morning after it left. Same shape as the query
    // above: one round trip, not one per row.
    getItineraryDayCountByTrip(),
  ]);

  // One light per trip, assigned across the whole list rather than per trip, so
  // no two trips on the screen come out the same colour while a palette is
  // free. Oldest first, which is what keeps an existing trip's colour from
  // moving when a new trip is created — see domain/aura.ts.
  // Every trip, in one list. There was a split here — active above, a collapsed
  // "בארכיון · N" below — and it was removed at the owner's request: "I want all
  // my trips shown, always". A home screen for trips that hides trips was
  // solving a problem nobody had.

  const auraByTrip = assignTripAuras(
    trips.map((trip) => ({
      id: trip.id,
      cities: citiesByTrip.get(trip.id) ?? [],
      createdAt: trip.created_at,
    })),
  );

  // One "today" for the whole render, resolved before anything that needs it.
  // Two calls to todayIn could straddle midnight and put the ordering and the
  // labels on different days — the sort would place a trip as departing
  // tomorrow while its own row said today.
  const today = todayIn(APP_TIME_ZONE, new Date());

  // The whole screen in one order: the trip being lived, then the ones ahead
  // by how soon they leave, then the undated, then the finished. listTrips
  // returns creation order, which is when you thought of a trip rather than
  // when it happens — see domain/trip-order.ts for why that was the wrong axis
  // for every tier below.
  const ordered = orderTripsByProximity(trips, today, dayCounts);

  // Feature the trip being lived, or else the next one out: its countdown, its
  // route, and its own light.
  //
  // This used to be pickUpcomingTrip, which skipped any trip that had already
  // departed — so while actually travelling, the screen featured the *next*
  // trip and the one being lived sat in the grid like any other row.
  //
  // No destination photo here any more. The hero this screen was designed for
  // is a field of light, and a photo underneath it would be a third thing
  // competing with the countdown and the route. getPlaceImage still serves the
  // trip's own "today" tab, where a picture of the place is the subject.
  const featured = pickFeaturedTrip(ordered);
  const upcoming = featured?.trip ?? null;
  let upcomingCities: string[] = [];
  // The itinerary's length, for the rail's countdown: tripPhase needs it to know
  // whether a trip with a start date and no end date is still ahead.
  let upcomingDayCount = 0;
  // The context pane's two cards. The mockup puts "what is coming" and "still
  // open" beside the trip list, and both are about the featured trip — this
  // screen's subject once there is one.
  let upcomingBookings: Booking[] = [];
  let upcomingOpen: OpenItem[] = [];

  if (upcoming) {
    // Route order comes from the itinerary when there is one. Before that,
    // fall back to the order cities were added — the chips are still right,
    // they just aren't in visiting order yet.
    const [itinerary, bookings] = await Promise.all([
      getItinerary(upcoming.id),
      listBookings(upcoming.id),
    ]);
    upcomingDayCount = itinerary.length;
    upcomingBookings = bookings;
    upcomingCities = itineraryStops(itinerary).map((stop) => stop.city);
    if (upcomingCities.length === 0) {
      const selected = await getSelectedDestinations(upcoming.id);
      upcomingCities = [
        ...new Set(selected.map((item) => item.city).filter(Boolean)),
      ];
    }

    upcomingOpen = tripOpenItems({
      startDate: upcoming.start_date,
      daysUntilStart: upcoming.start_date
        ? daysUntil(upcoming.start_date)
        : null,
      dayCount: upcomingDayCount,
      cities: upcomingCities,
      itinerary,
      bookings,
    });
  }

  const now = new Date().toISOString();

  // Three tiers, and the middle one is the new part.
  //
  // The screen had two sizes: the hero, and a grid where every remaining trip
  // was the same 44px tile in creation order. "Sort by which trip is closer and
  // give it room" cannot be said in a layout with one size below the hero.
  //
  //   hero      the featured trip — being lived, or leaving next
  //   near      the next few after it, as wide rows with the countdown loud
  //   grid      every trip, compact, as a complete index
  //
  // Three is a cap, not a rule about what is "near": a date threshold ("within
  // 30 days") reads as arbitrary the moment your next trip is in five weeks and
  // the screen goes flat. A fixed count means the tier is always populated when
  // there is anything to put in it, and never long enough to stop being a tier.
  //
  // The grid keeps every trip rather than only what the tiers above did not
  // take, including the featured one — "I want all my trips shown, always", the
  // same instruction that removed the archive. The tiers are emphasis, not a
  // filter, and "כל הטיולים · N" has to be able to count to N. The hero's trip
  // already appeared twice before this change and never read as a duplicate,
  // because the two are different questions: what now, and what do I have.
  // Ahead only. The first version sliced the next three off the ordered list
  // whatever they were, and with one active trip and one future one that put
  // "פראג, חורף שעבר · הסתיים לפני 258 ימים" under a heading that says "what is
  // next in line". A finished trip is not next in line, and neither is a trip
  // with no dates — nothing can be "next" in a sequence it is not in. Both
  // still appear, in the grid below, which is what that tier is for.
  const NEAR_COUNT = 3;
  const near = ordered
    .filter(
      (entry) =>
        entry.trip.id !== upcoming?.id &&
        (entry.phase.kind === "during" || entry.phase.kind === "before"),
    )
    .slice(0, NEAR_COUNT);

  return (
    <AppShell
      header={
        // No wordmark: the rail carries it now, the same as inside a trip. The
        // `brand` prop was a stand-in for exactly as long as this screen had no
        // rail — see T6.
        <AppHeader
          trailing={
            <>
              <NewTripButton />
              <LogoutButton />
            </>
          }
        />
      }
      // T6. This screen had no rail at all, which made the one screen everybody
      // starts on the only one that did not look like the app — crossing into a
      // trip moved the whole frame sideways by 248px. It carries the upcoming
      // trip's light, so the colour does not jump on that crossing either.
      sidebar={
        <HomeRail
          initial={user?.email?.[0]}
          hues={upcoming ? (auraByTrip.get(upcoming.id) ?? []) : []}
          upcoming={
            upcoming
              ? {
                  id: upcoming.id,
                  name: upcoming.name,
                  startDate: upcoming.start_date,
                  phase: tripPhase(
                    upcoming.start_date,
                    upcoming.end_date,
                    today,
                    upcomingDayCount,
                  ),
                  dayCount: upcomingDayCount,
                }
              : null
          }
        />
      }
      // The hero is a `banner` rather than the first child, and that is forced
      // rather than chosen: it reaches the edges of the content area with
      // negative margins, and inside the two-pane grid below those margins would
      // run sideways into the pane instead of off the screen.
      banner={
        upcoming ? (
          <AuraHero
            tripId={upcoming.id}
            name={upcoming.name}
            startDate={upcoming.start_date}
            cities={upcomingCities}
            // Straight from the list's assignment, not computed again from
            // upcomingCities: the hero and this trip's tile in the list below it
            // have to be the same colour, and only the assignment knows which
            // palette this trip ended up with after deconfliction.
            hues={auraByTrip.get(upcoming.id) ?? []}
            initial={user?.email?.[0]}
            // The same phase the ordering used, not one the hero works out for
            // itself: a trip already under way shows which day of it you are on
            // instead of a countdown that has run out.
            phase={featured?.phase}
            // Cancels AppShell pt-5: the hero is the first thing in main and
            // should meet the header. The component does not carry this itself —
            // the harness renders it under a scene title, where it would be
            // wrong.
            //
            // It is also the first thing the entrance shows, at 0ms: PageEnter
            // animates the banner as its own first child.
            className="-mt-5"
          />
        ) : undefined
      }
    >
      <TwoPane
        // The pane the mockup draws beside the trip list. Both cards are about
        // the featured trip, which is what this screen is about once there is
        // one — and with no upcoming trip there is nothing to put here, so the
        // pane collapses and the column centres.
        aside={
          upcoming &&
          (upcomingBookings.length > 0 || upcomingOpen.length > 0) ? (
            <>
              {/* TwoPane's aside is an `.enter-children` container, so these two
                  cards arrive at 0 and 45ms without anything here saying so.
                  The rows inside each one are told where to start, because a
                  third level cannot inherit the arithmetic — see the note on
                  `.enter-children`. */}
              <section className="flex flex-col gap-3">
                <SectionHeading level="section">מה מתקרב</SectionHeading>
                {/* Stamped on the server so "in 3 hours" cannot disagree
                    between the server render and hydration. */}
                <UpNext
                  bookings={upcomingBookings}
                  now={now}
                  cities={upcomingCities}
                  enterDelayMs={110}
                />
              </section>

              {upcomingOpen.length > 0 && (
                <OpenItems
                  tripId={upcoming.id}
                  items={upcomingOpen}
                  enterDelayMs={220}
                />
              )}
            </>
          ) : undefined
        }
      >
        {/* No wrapper of its own any more: TwoPane's main column is an
            `.enter-children` container, so these blocks arrive at 0, 45 and
            90ms without this page saying anything. It used to be a hand-rolled
            `.stagger` here, from before the entrance was a layout concern.

            Every child is conditional and that is fine — `:nth-child` counts
            rendered DOM elements, not JSX slots, so the delays follow what is
            actually on screen rather than leaving gaps where a block did not
            render. */}
        <>
          {/* Without a trip to feature there is no hero, so the screen still
              needs to say what it is. */}
          {!upcoming && (
            <SectionHeading level="page">הטיולים שלי</SectionHeading>
          )}

          {/* When the featured trip has nowhere to go, the next move is one
              decision and the screen should be about making it — not about the
              workflow in general. The two are mutually exclusive on purpose. */}
          {upcoming && upcomingCities.length === 0 && (
            <StartHere tripId={upcoming.id} />
          )}

          {/* Above the trip list, and expanded only for someone who has no
              trips yet — the point at which "what am I supposed to do here" is
              an actual question. It stays reachable, collapsed, for everyone
              else. */}
          <HowItWorks
            defaultOpen={trips.length === 0}
            tripId={upcoming?.id ?? trips[0]?.id ?? null}
          />

          {/* The middle tier. Present only when there is a second trip to put
              in it — with one trip the hero has already said everything, and an
              empty heading over nothing is worse than no section. */}
          {near.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading level="section">
                {/* "מה הבא בתור" and not "טיולים קרובים": the tier is ordered by
                    proximity and the reader is looking at the order, so the
                    heading should name the sequence rather than restate the
                    property every row already shows. */}
                מה הבא בתור
              </SectionHeading>
              <UpcomingTrips
                entries={near}
                citiesByTrip={citiesByTrip}
                auraByTrip={auraByTrip}
                enterDelayMs={220}
              />
            </section>
          )}

          <section className="flex flex-col gap-3">
            {trips.length > 0 && (
              <SectionHeading
                level="sub"
                description={user ? `מחובר כ-${user.email}` : undefined}
              >
                כל הטיולים · {trips.length}
              </SectionHeading>
            )}
            {/* The cards continue the column's sequence instead of restarting
                it. 220ms is two steps in: this section is the second or third
                child depending on which conditional blocks above rendered, and
                a one-step error either way is not visible. */}
            {/* Ordered, not as listTrips returned it: the grid is the index
                of everything, and an index that answers "what do I have" is
                still easier to read when the soonest thing is first. Same order
                as the tiers above, so a trip does not move between them. */}
            <TripList
              trips={ordered.map((entry) => entry.trip)}
              today={today}
              citiesByTrip={citiesByTrip}
              auraByTrip={auraByTrip}
              dayCounts={dayCounts}
              enterDelayMs={330}
            />
          </section>
        </>
      </TwoPane>

      {/* No password settings here, deliberately.
          A password can only be changed through the emailed link at
          /reset — which means every password change is authorised by proving
          control of the mailbox, and a stolen session cannot silently change the
          password and lock the owner out. Adding a password to a Google account
          was also removed: those accounts sign in with Google, and offering a
          second credential only widens what can be stolen. */}
    </AppShell>
  );
}
