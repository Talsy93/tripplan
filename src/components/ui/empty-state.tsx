import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  // An emoji or an icon element. Decorative — the title carries the meaning.
  icon?: ReactNode;
  title: string;
  description?: string;
  // A way out. This prop already existed and no caller ever passed it, so every
  // empty state in the app was a dead end; phase D wires it up.
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface-2 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-3xl leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
