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
    // The dashed outline is gone. A dashed border is the convention for
    // "something belongs here and is missing" — a drop target, a
    // placeholder — and an empty state is not broken, it is the normal first
    // state of a real screen. Drawn as a fault it made a new account look
    // like a fault. A soft filled surface says the same thing calmly.
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-tile bg-surface-2 px-6 py-12 text-center",
        className,
      )}
    >
      {/* The glyph gets a container. Loose at 30px it floated with nothing
          holding it; in a tile it reads as deliberate, and it gives the
          column a fixed anchor whatever the emoji's own metrics are. */}
      {icon && (
        <span
          className="flex h-16 w-16 items-center justify-center rounded-tile bg-surface text-3xl leading-none shadow-soft"
          aria-hidden="true"
        >
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
