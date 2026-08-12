import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// "tone" reads the nearest .tone-* ancestor, so a badge inside a city card
// picks up that city's colour without being told which one it is.
type Tone =
  | "neutral"
  | "primary"
  | "tone"
  | "success"
  | "warning"
  | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-tint text-primary",
  tone: "bg-tone text-tone-ink",
  success: "bg-success-tint text-success-ink",
  warning: "bg-warning-tint text-warning-ink",
  danger: "bg-danger-tint text-danger-ink",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
