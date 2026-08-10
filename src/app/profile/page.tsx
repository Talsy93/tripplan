import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  CreateTripForm,
  getPrimaryDestination,
  listTrips,
  pickUpcomingTrip,
  TripList,
  UpcomingTripCard,
} from "@/features/trips";
import { getPlaceImage } from "@/lib/place-image";

export default async function ProfilePage() {
  const [user, trips] = await Promise.all([getCurrentUser(), listTrips()]);

  // Feature the soonest upcoming trip with a photo of its destination.
  const upcoming = pickUpcomingTrip(trips);
  let upcomingImage: string | null = null;
  if (upcoming) {
    const city = await getPrimaryDestination(upcoming.id);
    upcomingImage = await getPlaceImage(city ?? upcoming.name);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">הטיולים שלי</h1>
          {user && (
            <span className="text-sm text-muted">מחובר כ-{user.email}</span>
          )}
        </div>
        <LogoutButton />
      </header>

      {upcoming && (
        <UpcomingTripCard trip={upcoming} imageUrl={upcomingImage} />
      )}

      <CreateTripForm />
      <TripList trips={trips} />
    </main>
  );
}
