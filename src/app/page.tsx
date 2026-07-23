import Link from "next/link";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import { buttonClasses } from "@/components/ui";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl">✈️</span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          TripPlan
        </h1>
        <p className="max-w-md text-lg text-muted">
          לתכנן חכם. לטייל טוב יותר.
        </p>
      </div>

      {user ? (
        <div className="flex items-center gap-2">
          <Link href="/profile" className={buttonClasses("primary")}>
            הטיולים שלי
          </Link>
          <LogoutButton />
        </div>
      ) : (
        <div className="flex gap-3">
          <Link href="/login" className={buttonClasses("outline")}>
            התחברות
          </Link>
          <Link href="/signup" className={buttonClasses("primary")}>
            הרשמה
          </Link>
        </div>
      )}
    </main>
  );
}
