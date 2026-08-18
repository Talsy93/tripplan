import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      // rounded-card, not Tailwind's rounded-md: a skeleton stands in for a real
      // surface, and the two disagreeing on their corners is a visible pop at
      // the moment of hydration. The map tab had exactly that — a rounded-card
      // skeleton replaced by a rounded-2xl frame.
      className={cn("animate-pulse rounded-card bg-surface-sunken", className)}
      {...props}
    />
  );
}
