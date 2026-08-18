import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui";

export const metadata = { title: "הדף לא נמצא · TripPlan" };

// Until phase D this file did not exist, so all seven notFound() calls in the
// app fell through to Next's built-in 404: black on white, left-to-right, in
// English. On a Hebrew RTL app that reads as a crash rather than a dead link.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
        aria-hidden="true"
      >
        <Compass className="h-7 w-7" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-bold">הדף הזה לא קיים</h1>
        <p className="max-w-md text-base text-muted">
          אולי הטיול נמחק, או שהקישור לא שלם. מהטיולים שלכם אפשר להגיע לכל השאר.
        </p>
      </div>

      <Link href="/profile" className={buttonClasses("primary")}>
        הטיולים שלי
      </Link>
    </main>
  );
}
