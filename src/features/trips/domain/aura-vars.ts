// The trip's light, as CSS custom properties.
//
// The band and the rail get their hues as props, because the layout renders
// them directly. Anything deeper cannot: a component three levels inside a tab
// would have to be handed them through every component between, or the tab
// would have to recompute them — and recomputing is not allowed here. A trip's
// palette is assigned across the whole list so that no two trips share one
// (domain/aura.ts), so the only way to get the same colour the band is showing
// is to run the same assignment, which costs two more queries per tab.
//
// Custom properties are the way out, and the codebase already works this way:
// .tone-* sets a trio on a container and children read bg-tone without knowing
// which colour they got. This is that, for the trip rather than the city.
//
// Values are the resolved CSS colours (`var(--aura-ember-1)` and friends), so a
// consumer writes var(--trip-hue-1) and never learns which palette it is in.

import type { CSSProperties } from "react";

export const TRIP_HUE_VARS = [
  "--trip-hue-1",
  "--trip-hue-2",
  "--trip-hue-3",
] as const;

// Spread onto a container. A trip with no destinations has no light, and then
// this is empty rather than black — consumers check for that themselves and
// most of them draw nothing.
export function tripHueStyle(hues: string[]): CSSProperties {
  const style: Record<string, string> = {};
  hues.slice(0, TRIP_HUE_VARS.length).forEach((hue, i) => {
    style[TRIP_HUE_VARS[i]] = hue;
  });
  return style as CSSProperties;
}

// What a consumer passes to AuraField. Reads back whatever the nearest ancestor
// set; `hasLight` is false when nothing did, which is the "trip with no
// destinations" case.
export function tripHuesFromVars(hasLight: boolean): string[] {
  return hasLight ? TRIP_HUE_VARS.map((name) => `var(${name})`) : [];
}
