import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  // An emoji or an icon element. Decorative — the title carries the meaning.
  icon?: ReactNode;
  title: string;
  description?: string;
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
        "flex flex-col items-center gap-3 rounded-card bg-surface-2 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-4xl leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-display text-lg">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
