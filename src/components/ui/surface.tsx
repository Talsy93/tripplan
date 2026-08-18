import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "sunken" | "quiet" | "outline";
type Padding = "none" | "sm" | "md" | "lg";

const tones: Record<Tone, string> = {
  // An inset well: information that belongs to its container rather than
  // standing apart from it. Map frames, info panels, nested lists.
  sunken: "bg-surface-2",
  quiet: "bg-surface-2 border border-border",
  outline: "border border-border bg-surface",
};

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  padding?: Padding;
};

// The panel that is not a card.
//
// Ten places in the app drew their own surface with a literal
// "rounded-2xl border border-border bg-surface-2 p-5" instead of using Card,
// which meant a change to Card reached none of them and their radii had already
// drifted from rounded-card to rounded-2xl. Those are not cards — a card is a
// discrete object in a list — so giving them their own primitive is more honest
// than widening Card until it covers both.
export function Surface({
  tone = "sunken",
  padding = "md",
  className,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn("rounded-card", tones[tone], paddings[padding], className)}
      {...props}
    />
  );
}
