import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// "tone" reads the nearest .tone-* ancestor, so a badge inside a city card
// picks up that city's colour without being told which one it is.
type Tone =
  | "neutral"
  | "action"
  | "callout"
  | "tone"
  | "success"
  | "warning"
  | "danger";

type Variant = "soft" | "solid";

const soft: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  action: "bg-action-tint text-action-ink",
  callout: "bg-callout-tint text-callout-ink",
  tone: "bg-tone text-tone-ink",
  success: "bg-success-tint text-success-ink",
  warning: "bg-warning-tint text-warning-ink",
  danger: "bg-danger-tint text-danger-ink",
};

// The loud form. Booking uses a filled badge sparingly and it always means
// "this number or state is the point of the row" — a count, a deadline.
const solid: Record<Tone, string> = {
  neutral: "bg-foreground text-surface",
  action: "bg-action text-primary-foreground",
  callout: "bg-callout text-callout-ink",
  tone: "bg-tone-dot text-surface",
  success: "bg-success text-primary-foreground",
  warning: "bg-callout text-callout-ink",
  danger: "bg-danger text-primary-foreground",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  variant?: Variant;
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
        variant === "solid" ? solid[tone] : soft[tone],
        className,
      )}
      {...props}
    />
  );
}

// The city dot, extracted because it appeared by hand in six files as
// "h-2 w-2 rounded-full bg-tone-dot" / "h-2.5 w-2.5 ..." — same idea, three
// sizes. Decorative: the city's name is always next to it.
export function ToneDot({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-tone-dot",
        className,
      )}
      {...props}
    />
  );
}
