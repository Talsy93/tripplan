import Link from "next/link";
import { CalendarDays, Compass, MapPinned, Plane } from "lucide-react";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import { buttonClasses } from "@/components/ui";
import { PageEnter } from "@/components/layout";

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
          MyTrip
        </span>
        {user && (
          <span className="ms-auto">
            <LogoutButton />
          </span>
        )}
      </header>

      <PageEnter className="mx-auto max-w-3xl flex-1 justify-center gap-10 px-4 py-12 md:px-6">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="text-display font-bold sm:text-hero">
            לתכנן חכם. לטייל טוב יותר.
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted">
            מיעד ראשון ועד לוח זמנים מלא — MyTrip בונה איתכם את הטיול,
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

        {/* Not cards. A bordered, elevated box on a landing page reads as a
            control — three of them in a row look like three buttons, and
            visitors were trying to click them. These are prose with an icon
            beside it: no border, no surface, nothing that invites a click
            except the actual buttons above.

            stagger + animate-rise on top of that, chained after the block above
            rather than starting with it: the list is PageEnter's second child
            and so arrives at 45ms, and 90ms is where its own items pick the
            sequence up. Without the base all three would land while the heading
            is still moving, which reads as one block fading in rather than as a
            page being built. Same idea as the `enterDelayMs` prop on TripList
            and UpNext, expressed inline because there is no component here to
            take it. */}
        <ul
          className="stagger grid gap-x-8 gap-y-6 sm:grid-cols-3"
          style={{ "--stagger-base": "90ms" } as React.CSSProperties}
        >
          {SELLING_POINTS.map(({ Icon, title, body }) => (
            <li key={title} className="flex animate-rise flex-col gap-2">
              <Icon
                className="h-6 w-6 text-primary-ink"
                aria-hidden="true"
              />
              <span className="text-base font-semibold">{title}</span>
              <span className="text-sm text-muted">{body}</span>
            </li>
          ))}
        </ul>
      </PageEnter>

      {/* The policy has to be findable without starting a signup — somebody
          deciding whether to sign up at all is exactly who wants to read it. */}
      <footer className="border-t border-border px-4 py-6 text-center md:px-6">
        <Link
          href="/privacy"
          className="rounded-control text-caption text-muted hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          מדיניות פרטיות
        </Link>
      </footer>
    </main>
  );
}
