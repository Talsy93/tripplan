import Link from "next/link";
import { CalendarDays, Compass, MapPinned, Plane } from "lucide-react";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import { buttonClasses, Card } from "@/components/ui";

const SELLING_POINTS = [
  {
    Icon: Compass,
    title: "הצעות שמתאימות לכם",
    body: "יעדים ומקומות לפי מה שאתם אוהבים ולפי הזמן שיש לכם.",
  },
  {
    Icon: CalendarDays,
    title: "לוח זמנים שמסתדר",
    body: "כל מה שבחרתם מסודר לימים ולשעות, עם מזג האוויר וההזמנות.",
  },
  {
    Icon: MapPinned,
    title: "הכול על מפה אחת",
    body: "המסלול, התחנות והדרך מהלינה לכל יעד — במקום אחד.",
  },
] as const;

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-6 lg:px-8">
        <span className="flex items-center gap-1.5 font-bold text-brand">
          <Plane className="h-5 w-5" aria-hidden="true" />
          TripPlan
        </span>
        {user && (
          <span className="ms-auto">
            <LogoutButton />
          </span>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-12 md:px-6">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="text-display font-bold sm:text-hero">
            לתכנן חכם. לטייל טוב יותר.
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted">
            מיעד ראשון ועד לוח זמנים מלא — TripPlan בונה איתכם את הטיול,
            ואז מלווה אותו ביום־יום.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {user ? (
              <Link href="/profile" className={buttonClasses("primary", "lg")}>
                הטיולים שלי
              </Link>
            ) : (
              <>
                <Link href="/signup" className={buttonClasses("primary", "lg")}>
                  התחלה בחינם
                </Link>
                <Link href="/login" className={buttonClasses("outline", "lg")}>
                  התחברות
                </Link>
              </>
            )}
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {SELLING_POINTS.map(({ Icon, title, body }) => (
            <li key={title}>
              <Card className="flex h-full flex-col gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
