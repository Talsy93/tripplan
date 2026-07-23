import { getCurrentUser, LogoutButton } from "@/features/auth";
import { CreateTripForm, listTrips, TripList } from "@/features/trips";

export default async function ProfilePage() {
  const [user, trips] = await Promise.all([getCurrentUser(), listTrips()]);

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

      <CreateTripForm />
      <TripList trips={trips} />
    </main>
  );
}
