"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Map as MapIcon, Maximize2, MapPinOff } from "lucide-react";
import { Card } from "@/components/ui";
import type { RoutePlace, RouteStop } from "../domain/route";

// Leaflet has no server rendering — it needs a real DOM. Loading the canvas only
// in the browser keeps the card around it server-rendered, the same arrangement
// route-map.tsx and day-map-card.tsx use.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

// The whole route on a small map, for a context pane.
//
// This exists because the pane on "מה עושים?" was rendering `RouteMap` — the
// component written for the מפה tab, and written for it specifically:
// `100dvh` minus the app bar, negative margins that cancel AppShell's padding to
// reach the window edge, a floating chip row, and a `lg:flex-row` split that
// puts the schedule beside the map. Dropped into a 372px column all four are
// wrong at once. The map was a screen tall inside the pane, its negative margins
// pulled it out of the column, and the schedule tried to become a second column
// of its own inside 372px.
//
// So the pane gets its own card and the tab keeps the full component. What
// differs is not styling — it is which question is being answered. The tab is
// for looking at the route; this is for "where is that?" while you are choosing,
// which is a glance, and a glance gets a way out to the real thing rather than
// controls of its own.
export function RouteMapCard({
  tripId,
  stops,
  places,
  // Cities the geocoder could not place. Reported as a count, not as a repair
  // form: the form lives on the מפה tab, one click away, and a pane beside a
  // search box is the wrong place to ask someone how a city is spelled in its
  // own script.
  unlocatedCount,
}: {
  tripId: string;
  stops: RouteStop[];
  places: RoutePlace[];
  unlocatedCount: number;
}) {
  if (stops.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted"
          aria-hidden="true"
        >
          <MapIcon className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">המפה תתמלא כשתבחרו יעדים</p>
        <p className="max-w-measure text-caption text-muted">
          כל מקום שתוסיפו כאן יופיע כסיכה, לפי סדר התחנות.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Leaflet's zoom and attribution controls are laid out LTR; a map is a
          viewport rather than text, so it opts out of the app's direction. The
          row below does not — it is text. */}
      <div dir="ltr" className="h-[15rem] w-full">
        <RouteMapCanvas stops={stops} places={places} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="min-w-0 truncate text-caption text-muted">
          {stops.length === 1 ? "תחנה אחת" : `${stops.length} תחנות`}
          {unlocatedCount > 0 && (
            <>
              {" · "}
              <span className="inline-flex items-center gap-1 text-warning-ink">
                <MapPinOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                {unlocatedCount === 1
                  ? "עיר אחת בלי מיקום"
                  : `${unlocatedCount} ערים בלי מיקום`}
              </span>
            </>
          )}
        </span>
        <Link
          href={`/trips/${tripId}/map`}
          className="flex shrink-0 items-center gap-1 rounded-control text-caption font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          מסך מלא
        </Link>
      </div>
    </Card>
  );
}
