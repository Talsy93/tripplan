import { getCurrentUser, LogoutButton } from "@/features/auth";
import { CreateTripForm, listTrips, TripList } from "@/features/trips";

export default async function ProfilePage() {
  const [user, trips] = await Promise.all([getCurrentUser(), listTrips()]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">הטיולים שלי</h1>
        <LogoutButton />
      </header>

      {user && (
        <p className="text-sm text-gray-500">מחובר כ-{user.email}</p>
      )}

      <CreateTripForm />
      <TripList trips={trips} />
    </main>
  );
}
