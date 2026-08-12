import { CountdownHero, DayPager, TripNav } from "@/features/trips";
import type { ItineraryDay } from "@/features/trips";
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

function entry(
  id: string,
  title: string,
  startLabel: string,
  endLabel: string,
  city: string,
) {
  return {
    id,
    title,
    startLabel,
    endLabel,
    note: "",
    city,
    latitude: null,
    longitude: null,
  };
}

const DEMO_DAYS: ItineraryDay[] = [
  {
    day: 1,
    items: [
      entry("a1", "נחיתה ונסיעה למלון", "14:00", "15:30", "ליסבון"),
      entry("a2", "ארוחת ערב בבאירו אלטו", "20:00", "22:00", "ליסבון"),
    ],
  },
  {
    day: 2,
    items: [
      entry("b1", "ארוחת בוקר", "09:00", "10:00", "ליסבון"),
      entry("b2", "מנזר ז׳רונימוש", "10:30", "12:30", "ליסבון"),
      entry("b3", "ארוחת צהריים בטיים אאוט", "13:00", "14:30", "ליסבון"),
      entry("b4", "מגדל בלם", "15:00", "16:30", "ליסבון"),
      entry("b5", "שקיעה במירדורו", "17:30", "19:00", "ליסבון"),
    ],
  },
  {
    day: 3,
    items: [
      entry("c1", "רכבת לסינטרה", "08:30", "09:30", "סינטרה"),
      entry("c2", "ארמון פנה", "10:00", "13:00", "סינטרה"),
      entry("c3", "קינטה דה רגלייה", "14:00", "16:30", "סינטרה"),
    ],
  },
];

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

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted">
            הניווט — שורת גלולות מ-md ומעלה, סרגל קבוע מתחתיו
          </p>
          {/* A transform makes this element the containing block for its
              fixed descendants, so the bottom bar demos inside the frame
              instead of sticking to the viewport of this page. */}
          <div
            className="relative h-40 overflow-hidden rounded-card border border-border bg-background p-4"
            style={{ transform: "translateZ(0)" }}
          >
            <TripNav tripId="demo" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted">
            מסך ״היום״ — נפתח על יום 2, חיצים ורצועת ימים לדילוג
          </p>
          <div className="max-w-xl rounded-card border border-border bg-background p-4">
            <DayPager
              days={DEMO_DAYS}
              initialDay={2}
              startDate={isoInDays(-1)}
              currentDay={2}
              bookingsByDay={{}}
            />
          </div>
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
