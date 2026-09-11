"use client";

import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import type { RoutePlace, RouteStop } from "../domain/route";

// The canvas of the trip workspace: the route map, filling whatever box the
// layout gives it, beside (or under) the panel.
//
// A thin client wrapper rather than the canvas itself, because Leaflet touches
// `window` on import and has to be loaded with ssr: false — and the layout
// that places this is a server component that cannot call next/dynamic with
// that option.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export function WorkspaceMap({
  stops,
  places = [],
  liveCity = null,
}: {
  stops: RouteStop[];
  places?: RoutePlace[];
  // The city the traveller is in right now; its pin is drawn in amber.
  liveCity?: string | null;
}) {
  if (stops.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:20px_20px] p-6">
        <div className="flex max-w-xs flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-lift">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
            <MapIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold">המפה תתמלא כשתבחרו יעדים</p>
          <p className="text-sm text-muted">
            כל עיר ומקום שתוסיפו בטאב ״יעדים״ יופיעו כאן כסיכה ממוספרת.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-full w-full">
      <RouteMapCanvas
        stops={stops}
        places={places}
        liveCity={liveCity}
        interactive
      />
    </div>
  );
}
