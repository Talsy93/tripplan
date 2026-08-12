import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only dedupes classes it recognises. Our own theme names from
// globals.css are invisible to it by default, so "rounded-control rounded-full"
// survived as both and CSS source order decided the winner — the exact bug this
// file exists to prevent. Colours and shadows need no help: an unknown bg-*,
// text-* or shadow-* already falls into the right group. Radii and the display
// font sizes do, because "rounded-card" and "text-title" look like nothing.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["control", "card", "tile"] }],
      "font-size": [{ text: ["hero", "display", "title"] }],
    },
  },
});

// Joins class names and lets later ones win. The plain join this replaced
// produced "px-4 px-6" and left the outcome to CSS source order, so a className
// passed into a component silently lost to the component's own default.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
