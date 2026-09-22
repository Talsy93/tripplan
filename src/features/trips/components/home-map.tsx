"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { MappedTrip } from "./trips-map-canvas";

// The canvas of the home screen (v5): every trip that has coordinates, drawn
// on one world map behind the floating panel. Client-side for the same reason
// WorkspaceMap is — Leaflet cannot render on the server.
const TripsMapCanvas = dynamic(() => import("./trips-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

// What the panel over this map is covering, so a trip the map flies to lands
// where it can be seen. Both numbers belong to other components and are copied
// here rather than read from them — see below.
//
// `--container-panel` is 27.5rem and BottomSheet pins the floating card 1rem
// from the edge: 440 + 16.
const PANEL_WIDTH = 456;
// BottomSheet's "half" snap, which is the one the home screen opens at. A
// share rather than pixels because that is what the sheet itself is.
const SHEET_SHARE = 0.58;

// lg, the breakpoint at which BottomSheet stops being a sheet.
const DESKTOP = "(min-width: 64rem)";

// useSyncExternalStore rather than an effect that sets state: a media query is
// exactly the external store this hook is for, and calling setState from an
// effect body is a cascading render the lint rule rightly refuses.
//
// The server snapshot is `true`. The map is client-only anyway (`ssr: false`),
// so nothing renders from it; it just has to be a value.
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(DESKTOP);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

export function HomeMap({
  trips,
  // The trip the panel is pointing at. Owned by HomeScreen above both of them,
  // because the selection is the one piece of state the map and the list share.
  selectedId = null,
  onSelect,
}: {
  trips: MappedTrip[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const desktop = useIsDesktop();

  if (trips.length === 0) {
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
        interactive
        selectedId={selectedId}
        onSelect={onSelect}
        // The panel is a column on the left from lg up — left and not right
        // because the document is RTL — and a sheet across the bottom below it.
        insetLeft={desktop ? PANEL_WIDTH : 0}
        insetBottomShare={desktop ? 0 : SHEET_SHARE}
      />
    </div>
  );
}
