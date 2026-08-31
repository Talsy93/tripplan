import { AppHeader, AppShell } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  APP_TIME_ZONE,
  assignTripAuras,
  AuraHero,
  HowItWorks,
  NewTripButton,
  getItinerary,
  getSelectedCitiesByTrip,
  getSelectedDestinations,
  itineraryStops,
  listTrips,
  pickUpcomingTrip,
  StartHere,
  todayIn,
  TripList,
} from "@/features/trips";

export const metadata = { title: "הטיולים שלי · MyTrip" };

export default async function ProfilePage() {
  const [user, trips, citiesByTrip] = await Promise.all([
    getCurrentUser(),
    listTrips(),
    // One query for every trip's cities, which is what each trip's light is
    // derived from. Per-row it would have been one round trip per trip.
    getSelectedCitiesByTrip(),
  ]);


  // One light per trip, assigned across the whole list rather than per trip, so
  // no two trips on the screen come out the same colour while a palette is
  // free. Oldest first, which is what keeps an existing trip's colour from
  // moving when a new trip is created — see domain/aura.ts.
  const auraByTrip = assignTripAuras(
    trips.map((trip) => ({
      id: trip.id,
      cities: citiesByTrip.get(trip.id) ?? [],
      createdAt: trip.created_at,
    })),
  );

  // Feature the soonest upcoming trip: its countdown, its route, and its own
  // light.
  //
  // No destination photo here any more. The hero this screen was designed for
  // is a field of light, and a photo underneath it would be a third thing
  // competing with the countdown and the route. getPlaceImage still serves the
  // trip's own "today" tab, where a picture of the place is the subject.
  const upcoming = pickUpcomingTrip(trips);
  let upcomingCities: string[] = [];

  if (upcoming) {
    // Route order comes from the itinerary when there is one. Before that,
    // fall back to the order cities were added — the chips are still right,
    // they just aren't in visiting order yet.
    const itinerary = await getItinerary(upcoming.id);
    upcomingCities = itineraryStops(itinerary).map((stop) => stop.city);
    if (upcomingCities.length === 0) {
      const selected = await getSelectedDestinations(upcoming.id);
      upcomingCities = [
        ...new Set(selected.map((item) => item.city).filter(Boolean)),
      ];
    }
  }

  return (
    <AppShell
      header={
        <AppHeader
          trailing={
            <>
              <NewTripButton />
              <LogoutButton />
            </>
          }
        />
      }
    >
      {/* The hero comes first and reaches the viewport edge — this screen has
          no page title of its own any more, because the hero is it. The old
          "הטיולים שלי" heading plus a "הטיול הקרוב" sub-heading above a card
          was three levels of chrome introducing one trip. */}
      {upcoming && (
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
          // Cancels AppShell pt-5: the hero is the first thing in main and
          // should meet the header. The component does not carry this itself —
          // the harness renders it under a scene title, where it would be wrong.
          className="-mt-5"
        />
      )}

      {/* Without a trip to feature there is no hero, so the screen still needs
          to say what it is. */}
      {!upcoming && (
        <SectionHeading level="page">הטיולים שלי</SectionHeading>
      )}

      {/* When the featured trip has nowhere to go, the next move is one
          decision and the screen should be about making it — not about the
          workflow in general. The two are mutually exclusive on purpose. */}
      {upcoming && upcomingCities.length === 0 && (
        <StartHere tripId={upcoming.id} />
      )}

      {/* Above the trip list, and expanded only for someone who has no trips
          yet — the point at which "what am I supposed to do here" is an actual
          question. It stays reachable, collapsed, for everyone else. */}
      <HowItWorks
        defaultOpen={trips.length === 0}
        tripId={upcoming?.id ?? trips[0]?.id ?? null}
      />

      <section className="flex flex-col gap-3">
        {trips.length > 0 && (
          <SectionHeading
            level="sub"
            description={user ? `מחובר כ-${user.email}` : undefined}
          >
            כל הטיולים · {trips.length}
          </SectionHeading>
        )}
        <TripList
          trips={trips}
          today={todayIn(APP_TIME_ZONE, new Date())}
          citiesByTrip={citiesByTrip}
          auraByTrip={auraByTrip}
        />
      </section>

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
