import { AppHeader, AppShell } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import {
  getCurrentUser,
  hasPasswordIdentity,
  LogoutButton,
  PasswordSettings,
} from "@/features/auth";
import {
  APP_TIME_ZONE,
  CountdownHero,
  HowItWorks,
  NewTripButton,
  getItinerary,
  getPrimaryDestination,
  getSelectedDestinations,
  itineraryStops,
  listTrips,
  pickUpcomingTrip,
  todayIn,
  TripList,
} from "@/features/trips";
import { getPlaceImage } from "@/lib/place-image";

export const metadata = { title: "הטיולים שלי · MyTrip" };

export default async function ProfilePage() {
  const [user, trips, hasPassword] = await Promise.all([
    getCurrentUser(),
    listTrips(),
    // Whether the account has a password identity at all. A Google-only account
    // has none — Supabase creates no password for a provider sign-in — so the
    // section below offers to set one rather than to change one.
    hasPasswordIdentity(),
  ]);

  // Feature the soonest upcoming trip: a photo of its destination, the
  // countdown, and the route as coloured chips.
  const upcoming = pickUpcomingTrip(trips);
  let upcomingImage: string | null = null;
  let upcomingCities: string[] = [];

  if (upcoming) {
    const [city, itinerary] = await Promise.all([
      getPrimaryDestination(upcoming.id),
      getItinerary(upcoming.id),
    ]);
    upcomingImage = await getPlaceImage(city ?? upcoming.name);

    // Route order comes from the itinerary when there is one. Before that,
    // fall back to the order cities were added — the chips are still right,
    // they just aren't in visiting order yet.
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
      <SectionHeading
        level="page"
        description={user ? `מחובר כ-${user.email}` : undefined}
      >
        הטיולים שלי
      </SectionHeading>

      {/* Above the trip list, and expanded only for someone who has no trips
          yet — the point at which "what am I supposed to do here" is an actual
          question. It stays reachable, collapsed, for everyone else. */}
      <HowItWorks
        defaultOpen={trips.length === 0}
        tripId={upcoming?.id ?? trips[0]?.id ?? null}
      />

      {upcoming && (
        <section className="flex flex-col gap-3">
          <SectionHeading level="sub">הטיול הקרוב</SectionHeading>
          <CountdownHero
            tripId={upcoming.id}
            name={upcoming.name}
            startDate={upcoming.start_date}
            imageUrl={upcomingImage}
            cities={upcomingCities}
            href={`/trips/${upcoming.id}`}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        {trips.length > 0 && (
          <SectionHeading level="sub">כל הטיולים · {trips.length}</SectionHeading>
        )}
        <TripList trips={trips} today={todayIn(APP_TIME_ZONE, new Date())} />
      </section>

      {/* Last on the page, collapsed, because it is an account setting and not
          something anyone came here to do — except a Google-only account, which
          has no other way to obtain a password. */}
      <section className="flex flex-col gap-3">
        <SectionHeading level="sub">החשבון</SectionHeading>
        <PasswordSettings hasPassword={hasPassword} />
      </section>
    </AppShell>
  );
}
