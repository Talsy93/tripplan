"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

// The band, except on the map.
//
// Every tab opens with the trip's light band — that is what made the redesign
// reach ten screens instead of one. The map is the exception the design draws
// deliberately: there the map *is* the content, it runs full-bleed from the app
// bar to the bottom of the viewport, and an 11rem band above it would take a
// third of the screen to repeat a name the app bar is already showing.
//
// A client component because that is the only way a layout can know which of
// its children is rendering — layouts receive no segment prop, and
// useSelectedLayoutSegment is the hook that exists for exactly this. It ships
// no state and no effects; the band itself stays a server component and is
// passed through as a child.
export function TripBandSlot({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  if (segment === "map") return null;
  return <>{children}</>;
}
