import Link from "next/link";
import { Card, SectionHeading } from "@/components/ui";
import { SCENES } from "./scenes";
import { ResponsiveCheck } from "./responsive-check";
import { developmentOnly } from "./guard";

export const metadata = { title: "Preview · MyTrip (dev)" };

// The index of the preview harness. Development only.
//
// Why this exists: every screen worth checking for layout sits behind
// authentication, and the assistant working on this project cannot sign in. That
// left the most complex screens in the app — the itinerary, the map, sharing —
// verified only by reading the code.
//
// A harness is better than a login would have been anyway. The states that break
// a layout are the ones that are awkward to reach in a real account: an empty
// trip, twenty bookings, a city the geocoder could not place, a name with no
// break opportunity. Here each is one URL.
//
// What it does NOT verify, and this matters: the data path. RLS, Server Actions
// actually writing, and anything that needs a session are all invisible here.
// A scene renders; it does not prove the button works.
export default function PreviewIndex() {
  developmentOnly();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <SectionHeading
        level="page"
        description="כל מסך שנמצא מאחורי התחברות, עם נתונים קבועים. פיתוח בלבד — לא קיים בפרודקשן."
      >
        Preview
      </SectionHeading>

      <p className="text-sm text-muted">
        מה שנבדק כאן הוא <strong>פריסה</strong>. לחיצה על כפתור לא תשמור כלום —
        אין סשן, וה-Server Actions ייכשלו. לבדיקת RLS וכתיבה צריך חשבון אמיתי.
      </p>

      <ResponsiveCheck slugs={SCENES.map((scene) => scene.slug)} />

      <ul className="flex flex-col gap-2">
        {SCENES.map((scene) => (
          <li key={scene.slug}>
            <Link
              href={`/preview/${scene.slug}`}
              className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card variant="interactive" className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{scene.title}</span>
                <span className="text-caption text-muted">{scene.note}</span>
                <span dir="ltr" className="text-caption text-muted">
                  /preview/{scene.slug}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
