"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Map as MapIcon, MapPinOff } from "lucide-react";
import type { ReactNode } from "react";
import { buildDayTimeline } from "../domain/timeline";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { RoutePlace, RouteStop } from "../domain/route";
import type { DayPin } from "./route-map-canvas";

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
      <div className="flex flex-col items-center gap-2 rounded-[20px] bg-surface px-6 py-8 text-center shadow-card">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary"
          aria-hidden="true"
        >
          <MapIcon className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">המפה תתמלא כשתבחרו יעדים</p>
        <p className="max-w-measure text-caption text-muted">
          כל מקום שתוסיפו כאן יופיע כסיכה, לפי סדר התחנות.
        </p>
      </div>
    );
  }

  // The Pencil map card (phase PN): a short strip of map with 20px corners and
  // two white pills floating on it — the stop count at the start, "פתח מפה"
  // at the end. No gradient over the tiles any more: white pills hold against
  // the map on their own, and a dark foot turned a glance at the route into a
  // photo caption.
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-surface-2 shadow-card">
      {/* Leaflet's controls are laid out LTR; a map is a viewport rather than
          text, so it opts out of the app's direction. */}
      <div dir="ltr" className="h-32 w-full sm:h-40 [&_.leaflet-control-zoom]:hidden">
        <RouteMapCanvas stops={stops} places={places} />
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex min-w-0 items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-card">
            {stops.length === 1 ? "תחנה אחת" : `${stops.length} תחנות`}
          </span>
          {/* Cities the geocoder could not place, as a count rather than a
              repair form — the form lives on the מפה tab, one press away. */}
          {unlocatedCount > 0 && (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface/90 px-2.5 py-1 text-[0.6875rem] font-medium text-muted shadow-card">
              <MapPinOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              {unlocatedCount === 1
                ? "עיר אחת בלי מיקום"
                : `${unlocatedCount} ערים בלי מיקום`}
            </span>
          )}
        </span>
        <Link
          href={`/trips/${tripId}/map`}
          className="pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 text-xs font-semibold text-foreground shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          פתח מפה
        </Link>
      </div>
    </div>
  );
}

// Exactly (0, 0) is a null that was written as a number, not a place.
function isUsable(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

// The day's places in the order the timeline lists them — timed entries by
// hour, then the untimed ones — split into those the map can pin and a count
// of those it cannot. Coordinates come with the entry: itinerary-service
// matches each one to the selected place it was built from, so an AI guide
// item (a name and nothing more) is simply the unlocated remainder.
export function dayMapPins(day: ItineraryDay): {
  pins: DayPin[];
  unlocated: number;
} {
  const timeline = buildDayTimeline(day);
  const ordered = [
    ...timeline.entries.map((placed) => placed.entry),
    ...timeline.unscheduled,
  ];
  const pins: DayPin[] = [];
  for (const entry of ordered) {
    if (!isUsable(entry.latitude, entry.longitude)) continue;
    pins.push({
      id: entry.id,
      label: entry.title,
      latitude: entry.latitude as number,
      longitude: entry.longitude as number,
    });
  }
  return { pins, unlocated: ordered.length - pins.length };
}

// The route tab's map: the day on screen, not the trip.
//
// Every place of the day with coordinates, numbered in timeline order with the
// route line through them, fitted to their bounds — pin 3 is the third card
// below. The pill counts what is on the map; the places it could not pin are a
// second, quieter pill rather than a silent gap.
//
// A day with nothing to pin (an empty day, or one built from AI guide items
// alone) falls back to `fallback` — on the page, the whole-route card — rather
// than to an empty rectangle.
export function DayRouteMapCard({
  tripId,
  day,
  fallback = null,
}: {
  tripId: string;
  day: ItineraryDay;
  fallback?: ReactNode;
}) {
  const { pins, unlocated } = dayMapPins(day);
  if (pins.length === 0) return <>{fallback}</>;

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-surface-2 shadow-card">
      <div dir="ltr" className="h-32 w-full sm:h-40 [&_.leaflet-control-zoom]:hidden">
        <RouteMapCanvas stops={[]} pins={pins} />
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex min-w-0 items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-card">
            {pins.length === 1 ? "תחנה אחת" : `${pins.length} תחנות`}
          </span>
          {unlocated > 0 && (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface/90 px-2.5 py-1 text-[0.6875rem] font-medium text-muted shadow-card">
              <MapPinOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              {unlocated === 1 ? "מקום אחד בלי מיקום" : `${unlocated} מקומות בלי מיקום`}
            </span>
          )}
        </span>
        <Link
          href={`/trips/${tripId}/map`}
          className="pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 text-xs font-semibold text-foreground shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          פתח מפה
        </Link>
      </div>
    </div>
  );
}
