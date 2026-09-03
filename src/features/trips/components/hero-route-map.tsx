"use client";

import dynamic from "next/dynamic";
import type { RouteStop } from "../domain/route";

// Loaded in the browser only, like every other user of this canvas: Leaflet
// touches `window` at import time.
//
// The skeleton is the trip's own dark base rather than a pale pulse. This sits
// directly behind white text, and a light placeholder would flash the hero
// unreadable for as long as the tiles take.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-aura-base" />,
});

// The hero's backdrop, when the trip knows where it goes.
//
// The map replaces the field of light rather than joining it. Two backgrounds
// arguing about the same rectangle was the reason destination photographs were
// removed in the first place, and a map under an aura would be that argument
// again with more moving parts.
//
// The scrim is what makes this work at all. OpenStreetMap tiles are pale,
// busy, and carry their own place names; white type straight over them is
// unreadable exactly where it matters. Rather than dimming the whole map to a
// grey wash — which throws away the thing worth showing — the darkness is
// weighted to where the words are.
//
// Vertical, and that is a correctness decision rather than a taste one. The
// hero's content block is `mt-auto`, so it sits on the bottom edge in both
// layouts: stacked under 1024px, and in a row above it. A horizontal scrim
// would have to know which side the countdown is on, which in an RTL document
// is the right — and would then be wrong for the stacked layout, where the
// content spans the full width. Bottom-weighted is right for both, and it does
// not need to know which way the document reads.
export function HeroRouteMap({ stops }: { stops: RouteStop[] }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="h-full w-full">
        <RouteMapCanvas stops={stops} still />
      </div>

      {/* Two layers, not one. The flat tint pulls OSM's greens and beiges back
          into the app's own family so the hero's colour is still the app's;
          the gradient on top carries the text. Both `pointer-events-none`, so
          the stretched link underneath still takes a click anywhere on the
          band. */}
      <div className="pointer-events-none absolute inset-0 bg-aura-base/25" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(20,28,58,0.92)_0%,rgba(20,28,58,0.58)_45%,rgba(20,28,58,0.18)_100%)]" />
    </div>
  );
}
