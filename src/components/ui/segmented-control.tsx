import { cn } from "@/lib/cn";

export type SegmentedItem = {
  id: string;
  label: string;
  count?: number;
};

type SegmentedControlProps = {
  items: SegmentedItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  "aria-label"?: string;
};

// Controlled on purpose: the caller already owns the selection, and a second
// copy of it inside here is a second thing that can be wrong.
//
// role="group" with aria-pressed, not tablist/tab. A tab has to control a
// tabpanel, and this filters a list in place — announcing it as tabs sends a
// screen reader looking for panels that do not exist.
export function SegmentedControl({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 self-start rounded-full border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ms-1.5 opacity-60">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
