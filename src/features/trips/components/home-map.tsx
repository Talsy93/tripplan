"use client";

import dynamic from "next/dynamic";
import type { MappedTrip } from "./trips-map-canvas";

// The canvas of the home screen (v5): every trip that has coordinates, drawn
// on one world map behind the floating panel. Client-side for the same reason
// WorkspaceMap is — Leaflet cannot render on the server.
const TripsMapCanvas = dynamic(() => import("./trips-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export function HomeMap({ trips }: { trips: MappedTrip[] }) {
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
      <TripsMapCanvas trips={trips} interactive />
    </div>
  );
}
