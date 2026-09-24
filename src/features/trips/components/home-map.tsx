"use client";

import dynamic from "next/dynamic";
import type { MappedTrip, OpenedTrip } from "./trips-map-canvas";

// The world map card of the home screen: every trip that has coordinates, on
// one map. Client-side for the same reason WorkspaceMap is — Leaflet cannot
// render on the server.
const TripsMapCanvas = dynamic(() => import("./trips-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export function HomeMap({
  trips,
  // The trip the screen is pointing at. Owned by HomeScreen, because the
  // selection is the one piece of state the map and the cards share.
  selectedId = null,
  focusId = null,
  onSelect,
  // How much of the card's height the floating preview card covers, so a trip
  // the map flies to lands above it rather than behind it.
  insetBottomShare = 0,
  // The trip opened on the map (a second tap on it), with its destinations.
  opened = null,
}: {
  trips: MappedTrip[];
  selectedId?: string | null;
  focusId?: string | null;
  onSelect?: (id: string | null) => void;
  insetBottomShare?: number;
  opened?: OpenedTrip | null;
}) {
  const openedHasPoints =
    !!opened && opened.places.length + opened.cities.length > 0;
  if (trips.length === 0 && !openedHasPoints) {
    // No trip has a located city yet. A dotted canvas rather than an empty
    // map: an empty map of the world says "you have been nowhere", which is
    // not what a new account should read.
    return (
      <div
        aria-hidden="true"
        className="h-full w-full bg-background bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] bg-[size:20px_20px]"
      />
    );
  }

  return (
    <div dir="ltr" className="h-full w-full">
      <TripsMapCanvas
        trips={trips}
        // Still while it shows every trip: the card sits in a page that
        // scrolls, and a draggable map would take the swipes meant for it. The
        // pins still answer a press, and the view still flies to whatever is
        // selected. An opened trip switches pan and zoom on (see the canvas).
        interactive={false}
        selectedId={selectedId}
        focusId={focusId}
        onSelect={onSelect}
        insetBottomShare={insetBottomShare}
        opened={openedHasPoints ? opened : null}
      />
    </div>
  );
}
