import { cn } from "@/lib/cn";

export type SegmentedItem = {
  id: string;
  label: string;
  count?: number;
};

type Size = "sm" | "md";

// `sm` exists because itinerary.tsx had cloned this control at a smaller scale
// (p-0.5 / px-3 py-1 / text-xs) rather than ask for a size. Two of the four
// copies of this control that existed before phase D differed only in these
// numbers.
const tracks: Record<Size, string> = {
  sm: "gap-0.5 p-0.5",
  md: "gap-1 p-1",
};

const segments: Record<Size, string> = {
  sm: "px-3 py-1 text-caption",
  md: "px-4 py-1.5 text-sm",
};

type SegmentedControlProps = {
  items: SegmentedItem[];
  value: string;
  onChange: (id: string) => void;
  size?: Size;
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
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex self-start rounded-full border border-border bg-surface-2",
        // Scrolls sideways instead of pushing the page wider.
        //
        // The control sizes itself to its segments, and the count is data: the
        // bookings filter grows a tab per booking kind present, so a trip with
        // flights, trains and lodging has four. At 320px that was 18px wider
        // than the screen — found by the preview harness, because the control
        // only renders above two segments and no earlier fixture had three
        // kinds of booking in one trip.
        //
        // `max-w-full` so it can be narrower than its content, and the pill
        // shape is kept by letting the row scroll rather than wrap: a wrapped
        // segmented control stops reading as one track.
        "max-w-full overflow-x-auto",
        // Chrome and Safari still paint a scrollbar over the pill on hover
        // otherwise, which on a control this short is louder than the content.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        tracks[size],
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
              "rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              segments[size],
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
