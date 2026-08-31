// The aura palettes, and nothing else.
//
// Separate from ./aura so a component can name a palette without pulling in the
// assignment logic, and so the list has exactly one home. Adding a palette means
// adding its three --aura-<name>-N tokens in globals.css and its name here;
// nothing else needs to know.
//
// Ordered by lead hue around the wheel — orange, gold, chartreuse, teal, sky,
// lilac, pink, red — because ./aura walks this list to find a free palette, and
// stepping to a neighbour should land somewhere visibly different. It was five,
// which measured out at a 52% chance that a user with three trips saw two of
// them in the same colour.
export const AURA_PALETTES = [
  "ember",
  "grove",
  "moss",
  "lagoon",
  "azure",
  "dusk",
  "coral",
  "crimson",
] as const;

export type AuraPalette = (typeof AURA_PALETTES)[number];
