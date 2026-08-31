import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";

// An emoji at a fixed size, in a container.
//
// The project uses lucide for interface icons and emoji for domain identity — a
// booking kind, a gear category, a weather state (CLAUDE.md). That decision is
// good and this does not change it; what was missing was anywhere for the emoji
// to live. Written bare, each one rendered at whatever its own font metrics
// gave: the same row could carry a 20px ✈️ and a 17px 🏨, they sat on different
// baselines, and no two rows in a list started at the same x.
//
// So the glyph gets a box. The box is what makes a list read as a list — every
// row starts at the same place whatever glyph it carries — and it also stops the
// emoji from floating loose against the card, which was most of what made these
// rows look unfinished next to the aura hero.
//
// `tone` for a row that already sits inside a .tone-* subtree: the tile then
// carries the city's colour instead of neutral grey, which is the cheapest way
// to make a long list scannable by city.
//
// Decorative by definition — a glyph is never the only thing saying what a row
// is, so this is always aria-hidden and callers must not rely on it for meaning.

const sizes: Record<Size, string> = {
  sm: "h-9 w-9 text-base",
  md: "h-11 w-11 text-xl",
};

type GlyphProps = HTMLAttributes<HTMLSpanElement> & {
  size?: Size;
  tone?: boolean;
};

export function Glyph({
  size = "sm",
  tone = false,
  className,
  ...props
}: GlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-control leading-none",
        tone ? "bg-tone" : "bg-surface-2",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
