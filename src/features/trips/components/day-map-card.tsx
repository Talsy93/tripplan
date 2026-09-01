"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { RoutePlace, RouteStop } from "../domain/route";

// Leaflet has no server rendering — it needs a real DOM. Loading the canvas only
// in the browser keeps the card around it server-rendered, the same arrangement
// route-map.tsx uses.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

// "התחנות של היום" — the day's places on a small map, in the context pane.
//
// The mockup's desktop day screen opens its pane with this, and the reason is
// the one the whole two-pane layout rests on: "where is that?" is the question
// you would otherwise change tabs to answer and change back from. The מפה tab
// stays for looking at the route properly — this is a glance, so it gets a
// "מסך מלא" way out rather than controls of its own.
//
// Bounds come from the city's own stop, not from the places: a day with one
// located item would otherwise zoom to street level on that single point.
export function DayMapCard({
  tripId,
  stops,
  places,
}: {
  tripId: string;
  stops: RouteStop[];
  places: RoutePlace[];
}) {
  if (stops.length === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <span className="text-sm font-bold">התחנות של היום</span>
        <Link
          href={`/trips/${tripId}/map`}
          className="flex shrink-0 items-center gap-1 rounded-control text-caption font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          מסך מלא
        </Link>
      </div>

      {/* Leaflet's controls are laid out LTR; a map is a viewport rather than
          text, so it opts out of the app's direction. The heading above does
          not — it is text. */}
      <div dir="ltr" className="h-[11.5rem] w-full">
        <RouteMapCanvas stops={stops} places={places} />
      </div>
    </Card>
  );
}
