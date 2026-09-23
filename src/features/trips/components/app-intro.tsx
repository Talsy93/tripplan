import Link from "next/link";
import { CalendarDays, Compass, MapPinned } from "lucide-react";
import { NewTripButton } from "./create-trip-form";

// What MyTrip is, for someone with no trips yet.
//
// This was the site's landing page at `/`. Asked for as "drop the landing page
// — the first page is my trips; if there are no trips, add the explanation of
// the app there, and if there are, don't show it." So `/` goes straight to the
// trips, and the explanation lives where the first trip is created: in place
// of the empty list, above the one button that answers it.
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

export function AppIntro() {
  return (
    <section className="flex flex-col gap-6 rounded-xl bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl leading-7 font-semibold text-foreground">
          לתכנן חכם. לטייל טוב יותר.
        </h2>
        <p className="text-sm leading-5 text-muted-strong">
          מיעד ראשון ועד לוח זמנים מלא — MyTrip בונה איתכם את הטיול, ואז מלווה
          אותו ביום־יום.
        </p>
      </div>

      {/* Prose with an icon, not cards: three boxes in a row read as three
          buttons, and the only thing to press here is the one below. */}
      <ul className="stagger grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {SELLING_POINTS.map(({ Icon, title, body }) => (
          <li key={title} className="flex animate-rise gap-3 sm:flex-col sm:gap-2">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base leading-[22px] font-semibold">
                {title}
              </span>
              <span className="text-sm leading-5 text-muted-strong">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <NewTripButton />
        <Link
          href="/privacy"
          className="rounded-control text-caption text-muted hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          מדיניות פרטיות
        </Link>
      </div>
    </section>
  );
}
