import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "raised" | "flat" | "interactive";
type Padding = "none" | "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  raised: "border border-border bg-surface shadow-soft",
  flat: "border border-border bg-surface-2",
  interactive:
    "border border-border bg-surface shadow-soft transition-shadow hover:border-border-strong hover:shadow-lift",
};

// Card used to ship no padding at all, so call sites supplied their own and
// drifted: p-0 through p-8 all appeared, and two cards playing the same role in
// different features disagreed. Padding is a decision the component makes now;
// `none` stays available for the cards that genuinely split into bands of their
// own (a booking's header / route strip / meta row, for one).
const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  padding?: Padding;
};

export function Card({
  variant = "raised",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card",
        variants[variant],
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}
