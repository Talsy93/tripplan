import { CountdownHero } from "@/features/trips";
import { DesignPreview } from "./preview";

// Temporary page for the phase B visual work (item B0). Two jobs:
//   1. the variant mockup that settled the direction, and
//   2. a live rendering of the real components below it, with invented data —
//      /profile and /trips/[id] are behind auth, so this is the only way to see
//      the actual CountdownHero and its edge cases without signing in.
// Removed once phase B is done.
export const metadata = {
  title: "TripPlan — בחירת כיוון עיצובי",
};

const CITIES = ["ליסבון", "סינטרה", "פורטו", "אלגרבה"];

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DesignPreviewPage() {
  // Offsets rather than fixed dates: a hardcoded far-future date renders a
  // five-digit countdown that tells you nothing about how the real thing looks.
  const CASES = [
    { label: "לפני הטיול", startDate: isoInDays(33), cities: CITIES },
    { label: "יום היציאה", startDate: isoInDays(0), cities: CITIES },
    { label: "הטיול בעיצומו", startDate: isoInDays(-3), cities: CITIES },
    { label: "בלי תאריך", startDate: null, cities: CITIES },
    { label: "בלי ערים עדיין", startDate: isoInDays(1), cities: [] },
  ];

  return (
    <>
      <DesignPreview />

      <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 pb-12">
        <div>
          <h2 className="font-display text-lg">הרכיבים האמיתיים</h2>
          <p className="text-sm text-muted">
            אלה לא ציורים — זה <code>CountdownHero</code> עצמו, עם דאטה מומצא,
            בארבעת המצבים שלו.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {CASES.map((c) => (
            <div key={c.label} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted">{c.label}</p>
              <CountdownHero
                tripId={c.label}
                name="פורטוגל 2026"
                startDate={c.startDate}
                imageUrl={null}
                cities={c.cities}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
