import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

// A filter pill. Rendered as a button so it is reachable by keyboard and
// announces its state; a row of these replaces the overflowing tab strip.
export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-surface text-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
