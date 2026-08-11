"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui";
import type { TripRoute } from "../domain/route";

// Leaflet has no server rendering — it needs a real DOM. Loading the canvas
// only in the browser keeps the rest of the page server-rendered.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="h-[26rem] w-full animate-pulse rounded-2xl bg-surface-2" />
  ),
});

export function RouteMap({ route }: { route: TripRoute }) {
  if (route.stops.length === 0) {
    return (
      <Card className="flex h-[26rem] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-semibold">המפה תתמלא כשתבחרו יעדים</p>
        <p className="text-sm text-muted">
          הוסיפו דברים לטיול מתוך מדריכי הערים, והתחנות יופיעו כאן לפי הסדר.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Leaflet's zoom/attribution controls are laid out LTR; the map is a
          viewport, not text, so it opts out of the app's RTL direction. */}
      <div
        dir="ltr"
        className="overflow-hidden rounded-2xl border border-border shadow-soft"
      >
        <RouteMapCanvas stops={route.stops} />
      </div>

      <ol className="flex flex-wrap gap-2">
        {route.stops.map((stop, index) => (
          <li
            key={stop.city}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </span>
            {stop.city}
          </li>
        ))}
      </ol>

      {route.unlocatedCities.length > 0 && (
        <p className="text-sm text-muted">
          לא הצלחנו למקם על המפה: {route.unlocatedCities.join(", ")}
        </p>
      )}
    </div>
  );
}
