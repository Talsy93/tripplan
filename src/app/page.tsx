import Link from "next/link";
import { getCurrentUser, LogoutButton } from "@/features/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">TripPlan ✈️</h1>
      <p className="text-lg text-gray-500">לתכנן חכם. לטייל טוב יותר.</p>
      {user ? (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>מחובר כ-{user.email}</span>
          <LogoutButton />
        </div>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="underline">
            התחברות
          </Link>
          <Link href="/signup" className="underline">
            הרשמה
          </Link>
        </div>
      )}
    </main>
  );
}
