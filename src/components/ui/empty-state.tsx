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
      {/* Both strings can carry a name the user or the AI wrote, so both must be
          able to break mid-word. `max-w-sm` caps the line length but does not
          stop a single long token from pushing past it. */}
      <div className="flex min-w-0 max-w-full flex-col gap-1">
        <p className="text-base font-semibold wrap-anywhere">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted wrap-anywhere">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
