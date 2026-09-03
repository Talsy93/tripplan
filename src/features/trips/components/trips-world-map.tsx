"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { TripsDeck } from "./trips-deck";
import type { StandingTrip } from "../domain/trip-order";
import type { MappedTrip } from "./trips-map-canvas";

const TripsMapCanvas = dynamic(() => import("./trips-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

// Every trip on one map, with a deck of cards under it.
//
// The map answers "where are they, and how far apart" — a question no list can
// be arranged to answer, and the reason this replaced the grid of tiles.
//
// The deck replaced the legend list that first sat beside it. Sliding a card to
// the centre flies the map to that trip; the map is still otherwise, so the
// deck is the only thing the finger touches. That division is deliberate: a
// draggable map inside a vertically scrolling page eats every swipe meant for
// the page, and a 14px disc was never a tap target anyway.
//
// **The deck is built from every trip, not from the pins.** A trip the map
// cannot place still gets a card, still slides into focus, and says "לא על
// המפה" instead of quietly not existing — which is what keeps "I want all my
// trips shown, always" true of this screen.
//
// The known cost is in trips-deck.tsx: a deck hides most of itself past the
// edge, which is the same complaint that was made about the rail. It was chosen
// with that on the table.
export function TripsWorldMap({
  entries,
  auraByTrip,
  pointsByTrip,
}: {
  // Already ordered by proximity, the same order every other tier uses.
  entries: StandingTrip[];
  auraByTrip?: Map<string, string[]>;
  pointsByTrip?: Map<
    string,
    { city: string; latitude: number; longitude: number }[]
  >;
}) {
  // Which trip the deck has centred. The map reads it and flies; the deck owns
  // it because the deck is what the finger is touching.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Identity-stable, or the deck's effect re-runs on every parent render and
  // the map re-flies to where it already is.
  const handleFocus = useCallback((id: string | null) => setFocusedId(id), []);

  const mapped: MappedTrip[] = entries.flatMap((entry) => {
    const points = pointsByTrip?.get(entry.trip.id) ?? [];
    if (points.length === 0) return [];
    return [
      {
        id: entry.trip.id,
        name: entry.trip.name,
        // The lead hue of the palette this trip was assigned. Falls back to the
        // action blue rather than to nothing: a trip with located cities but no
        // light is a trip whose cities were never saved as destinations, and a
        // transparent pin would be a bug that looks like a missing trip.
        hue: auraByTrip?.get(entry.trip.id)?.[0] ?? "var(--primary)",
        points,
      },
    ];
  });

  const locatedIds = new Set(mapped.map((trip) => trip.id));

  return (
    <div className="flex flex-col gap-3">
      {/* The map above the deck rather than beside it.

          Side by side was right for a legend — a list reads in a column and
          sits happily in a narrow track. A deck is horizontal and wants the
          full width, and stacking also means the map keeps a real aspect ratio
          instead of being squeezed into whatever the split leaves it.

          Only when there is something to draw. With nothing located this would
          be a grey rectangle centred on the Atlantic, which says the app is
          broken rather than that the trips have not been placed yet — the same
          call the hero makes when it falls back to the light. */}
      {mapped.length > 0 && (
        <div className="h-64 overflow-hidden rounded-card border border-border sm:h-72">
          <TripsMapCanvas trips={mapped} focusedId={focusedId} />
        </div>
      )}

      <TripsDeck
        entries={entries}
        auraByTrip={auraByTrip}
        locatedIds={locatedIds}
        onFocus={handleFocus}
      />
    </div>
  );
}
