import Link from "next/link";
import { CalendarDays, Layers, Map as MapIcon, Navigation, Plus } from "lucide-react";
import { NewTripButton } from "./create-trip-form";

// What MyTrip is, for someone with no trips yet.
//
// This was the site's landing page at `/`. Asked for as "drop the landing page
// — the first page is my trips; if there are no trips, add the explanation of
// the app there, and if there are, don't show it." So `/` goes straight to the
// trips, and the explanation lives where the first trip is created: in place
// of the empty list, above the one button that answers it.
//
// Laid out as design/pencil/exports/home-empty: a map disc, the line, three
// white rows with an icon tile each, and the terracotta button last.
const SELLING_POINTS = [
  {
    Icon: Layers,
    title: "מוצאים מקומות",
    body: "מחליקים על קלפים ושומרים מה שאהבתם",
  },
  {
    Icon: CalendarDays,
    title: "מקבלים לו״ז",
    body: "המקומות מתחלקים לימים לבד",
  },
  {
    Icon: Navigation,
    title: "מטיילים רגוע",
    body: "מה עכשיו, מה הבא ואיפה ישנים",
  },
] as const;

export function AppIntro() {
  return (
    <section className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary-tint text-primary"
          aria-hidden="true"
        >
          <MapIcon className="h-10 w-10" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-[24px] font-bold leading-tight text-foreground">
            לתכנן חכם. לטייל טוב יותר.
          </h2>
          <p className="text-sm text-muted">
            כל הטיול במקום אחד: מקומות, לו״ז, כרטיסים והוצאות
          </p>
        </div>
      </div>

      {/* Rows, not buttons: nothing here is pressable except the one below. */}
      <ul className="stagger flex flex-col gap-3">
        {SELLING_POINTS.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="flex animate-rise items-center gap-3 rounded-[18px] bg-surface p-4 shadow-card"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-tint text-primary"
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-bold text-foreground">{title}</span>
              <span className="text-[13px] text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-3 pt-4">
        <NewTripButton className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-cta text-base font-semibold text-cta-foreground shadow-card transition-[background-color,transform] duration-150 hover:bg-cta-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span>תכנון הטיול הראשון</span>
        </NewTripButton>
        <Link
          href="/privacy"
          className="rounded-full px-2 py-1 text-caption text-outline hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          מדיניות פרטיות
        </Link>
      </div>
    </section>
  );
}
