import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  CountdownHero,
  CreateTripForm,
  getItinerary,
  getPrimaryDestination,
  getSelectedDestinations,
  itineraryStops,
  listTrips,
  pickUpcomingTrip,
  TripList,
} from "@/features/trips";
import { getPlaceImage } from "@/lib/place-image";

export default async function ProfilePage() {
  const [user, trips] = await Promise.all([getCurrentUser(), listTrips()]);

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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 lg:max-w-4xl">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-display text-2xl">הטיולים שלי</h1>
          {user && (
            <span className="text-sm text-muted">מחובר כ-{user.email}</span>
          )}
        </div>
        <LogoutButton />
      </header>

      {upcoming && (
        <CountdownHero
          tripId={upcoming.id}
          name={upcoming.name}
          startDate={upcoming.start_date}
          imageUrl={upcomingImage}
          cities={upcomingCities}
          href={`/trips/${upcoming.id}`}
        />
      )}

      <CreateTripForm />
      <TripList trips={trips} />
    </main>
  );
}
