import { cn } from "@/lib/cn";
import { categoryIcon } from "../domain/place";
import { DomainIcon } from "./domain-icon";

// The Pencil design's category mark: a lucide glyph in the category's ink on a
// rounded tile of its tint. One place for it, because four screens draw it —
// the add-places grid, the recommended rows, the picked list and the city
// guide's cards — and a mapping copied four times drifts.
//
// The palette has five category tones (globals.css, --cat-*) and the data has
// two vocabularies: the search's six OSM groups and the guide's four. So the
// mapping is by meaning, not one-to-one, and two eating categories share the
// food tone on purpose — a café and a bakery are the same kind of stop.
type CategoryTone = "mustsee" | "food" | "nature" | "shopping" | "hidden";

const TONE_BY_CATEGORY: Record<string, CategoryTone> = {
  // The search's six.
  attractions: "mustsee",
  restaurants: "food",
  bakeries: "food",
  cafes: "shopping",
  shopping: "shopping",
  temples: "hidden",
  // The guide's other two.
  experiences: "nature",
  areas: "hidden",
};

// Static class names, so Tailwind sees every one of them.
const TONE_CLASSES: Record<CategoryTone | "none", string> = {
  mustsee: "bg-cat-mustsee-tint text-cat-mustsee-ink",
  food: "bg-cat-food-tint text-cat-food-ink",
  nature: "bg-cat-nature-tint text-cat-nature-ink",
  shopping: "bg-cat-shopping-tint text-cat-shopping-ink",
  hidden: "bg-cat-hidden-tint text-cat-hidden-ink",
  // "אחר", and anything neither vocabulary knows: still a tile, so a row keeps
  // its shape, but in the neutral well rather than borrowing a category's tint.
  none: "bg-surface-sunken text-muted",
};

export function categoryToneClasses(category: string) {
  return TONE_CLASSES[TONE_BY_CATEGORY[category] ?? "none"];
}

const SIZES = {
  // The add-places grid: 56px, radius 18.
  lg: { tile: "h-14 w-14 rounded-[18px]", icon: "h-6 w-6" },
  // List rows: 44px, radius 14.
  md: { tile: "h-11 w-11 rounded-[14px]", icon: "h-5 w-5" },
} as const;

export function CategoryTile({
  category,
  size = "md",
  className,
}: {
  category: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        SIZES[size].tile,
        categoryToneClasses(category),
        className,
      )}
    >
      <DomainIcon name={categoryIcon(category)} className={SIZES[size].icon} />
    </span>
  );
}

// The route's stop colours, for the numbered pins and the rows that name them.
//
// The design draws each stop in a category ink with a white ring. A stop is a
// city, not a category, so the inks are dealt out by stop order — the point is
// that pin 3 on the map and dot 3 in the drawer are visibly the same thing.
// Both halves read from here: the Leaflet markup needs the CSS variable (it is
// built outside React, where a class cannot reach), the rows need the class.
const STOP_INKS = [
  { cssVar: "--cat-mustsee-ink", bg: "bg-cat-mustsee-ink" },
  { cssVar: "--cat-food-ink", bg: "bg-cat-food-ink" },
  { cssVar: "--cat-hidden-ink", bg: "bg-cat-hidden-ink" },
  { cssVar: "--cat-nature-ink", bg: "bg-cat-nature-ink" },
  { cssVar: "--cat-shopping-ink", bg: "bg-cat-shopping-ink" },
] as const;

// `position` is the 1-based stop number the pin prints.
export function stopInk(position: number) {
  return STOP_INKS[(Math.max(position, 1) - 1) % STOP_INKS.length];
}
