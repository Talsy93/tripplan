"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { buttonClasses, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { scheduleNewPlaces } from "../application/itinerary-actions";

// The add-places screen's one orange action. It used to be a link to מסלול,
// which is where the build lives — so pressing "שיבוץ" scheduled nothing and
// only changed tabs. Now it places what is new into the days that exist, says
// what it did, and then goes to מסלול to show it. With no schedule at all it
// goes there anyway: the first build is the model's job (a whole schedule from
// nothing), and that button is on that screen.
export function ScheduleButton({ tripId, className }: { tripId: string; className?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function schedule() {
    startTransition(async () => {
      const result = await scheduleNewPlaces(tripId);
      if (result.needsBuild) {
        showToast("עוד אין לו״ז — בונים אותו במסלול");
      } else if (result.placed > 0) {
        showToast(
          (result.placed === 1 ? "מקום אחד שובץ" : `${result.placed} מקומות שובצו`) +
            (result.unplaced > 0 ? ` · ${result.unplaced} בלי יום בעיר שלהם` : ""),
        );
      } else if (result.unplaced > 0) {
        showToast(`${result.unplaced} מקומות בעיר שאין לה עוד ימים בלו״ז`, "danger");
        return;
      } else if (!result.ok) {
        showToast("השיבוץ נכשל. נסו שוב.", "danger");
        return;
      } else {
        showToast("הכול כבר משובץ");
      }
      router.push(`/trips/${tripId}/days`);
    });
  }

  return (
    <button
      type="button"
      onClick={schedule}
      disabled={pending}
      className={cn(buttonClasses("primary", "md", "shrink-0 rounded-full px-5"), className)}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      )}
      שיבוץ לימים
    </button>
  );
}
