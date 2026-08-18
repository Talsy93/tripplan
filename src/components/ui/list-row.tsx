import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

type Accent = "none" | "tone" | "action" | "callout" | "success" | "danger";

const dots: Record<Exclude<Accent, "none">, string> = {
  tone: "bg-tone-dot",
  action: "bg-action",
  callout: "bg-callout",
  success: "bg-success",
  danger: "bg-danger",
};

type ListRowProps = {
  // An icon, a number badge, an emoji that carries domain meaning.
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  // Right-hand side: a time, a badge, a delete button.
  trailing?: ReactNode;
  accent?: Accent;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
};

// The row that ten places were each drawing by hand.
//
// They all said `border-s-4` plus a colour, but between them they used four
// different accent colours and two widths, and three of them also tinted the
// background. Phase D replaced the 4px stripe with a dot: the stripe was the
// single biggest contributor to the six-pastels-per-screen problem, because at
// 4px × full height a pastel stops being an accent and becomes a fill.
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  accent = "none",
  interactive = false,
  className,
  children,
}: ListRowProps) {
  return (
    <Card
      variant={interactive ? "interactive" : "raised"}
      padding="sm"
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-center gap-2.5">
        {accent !== "none" && (
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              dots[accent],
            )}
          />
        )}
        {leading}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{title}</span>
          {subtitle && (
            <span className="truncate text-caption text-muted">{subtitle}</span>
          )}
        </div>
        {trailing && (
          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            {trailing}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}
