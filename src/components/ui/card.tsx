import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "raised" | "flat" | "interactive";

const variants: Record<Variant, string> = {
  raised: "border border-border bg-surface shadow-soft",
  flat: "bg-surface-2",
  interactive:
    "border border-border bg-surface shadow-soft transition-shadow hover:shadow-lift",
};

type CardProps = HTMLAttributes<HTMLDivElement> & { variant?: Variant };

export function Card({ variant = "raised", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-card", variants[variant], className)}
      {...props}
    />
  );
}
