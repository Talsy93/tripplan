import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";

// A domain glyph at a fixed size, in a container.
//
// The box exists because bare glyphs never lined up: the same row could carry a
// 20px ✈️ and a 17px 🏨 on different baselines, and no two rows in a list
// started at the same x. That reason still holds for icons, which is why the box
// survived the change from emoji to lucide — see features/trips/domain/icons.ts.
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
// The glyph itself now takes that colour too, through currentColor. It could
// not before: an emoji is a picture with its own palette, so a tinted tile got
// a city-coloured background with an off-palette sticker sitting on it.
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
        tone ? "bg-tone text-tone-ink" : "bg-surface-2 text-muted",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
