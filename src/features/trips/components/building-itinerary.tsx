import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

// The cover over the itinerary while a new one is being built.
//
// Reported: while the model works, the old schedule stayed fully live
// underneath a button with a spinner in it. You could open a day, drag an
// entry, delete one — and every one of those edits was about to be thrown away
// by the rebuild that was already in flight, silently. The only sign anything
// was happening was a 3mm spinner in the aside.
//
// So the wait is drawn where the result will appear, and it takes the days out
// of reach while it is there. Two mechanisms, because they do different jobs:
//
//   this component   covers the days, and is what says what is going on
//   `inert` on the   takes the content underneath out of the tab order and
//   content          stops it receiving pointer events — the platform's own
//                    switch, rather than a `pointer-events-none` that a
//                    keyboard walks straight past
//
// The bars loop rather than filling once. A build has no progress to report —
// it is one request to a model that returns when it returns — and a bar that
// creeps to 90% and stops is a promise the app cannot keep.
export function BuildingItinerary({
  // How many placeholder days to draw. Capped, because the animation is a
  // picture of the work and not an inventory of it: twenty bars is a wall.
  dayCount = 4,
  className,
}: {
  dayCount?: number;
  className?: string;
}) {
  const rows = Array.from({ length: Math.min(Math.max(dayCount, 3), 5) });

  return (
    <div
      // `status` and not `alert`: this is a running condition, not something
      // that just went wrong. aria-live polite so it is announced once the
      // screen reader finishes whatever it was saying.
      role="status"
      aria-live="polite"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-start gap-5",
        "rounded-card bg-surface/88 p-6 backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Sparkles
            className="h-4 w-4 animate-pulse text-primary"
            aria-hidden="true"
          />
          בונים את הלו&quot;ז
        </span>
        <span className="text-caption text-muted">
          זה לוקח כמה שניות. הלו&quot;ז הקודם יוחלף כשזה ייגמר, אז אין טעם
          לערוך אותו עכשיו.
        </span>
      </div>

      {/* The picture of a day being written: a number, then a line that grows
          from the inline start. One set per placeholder day, each starting a
          beat after the one above it. */}
      <ul
        aria-hidden="true"
        className="flex w-full max-w-md flex-col gap-3"
      >
        {rows.map((_, index) => (
          <li key={index} className="flex min-w-0 items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-caption font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className="h-2.5 animate-build-line rounded-full bg-primary/30"
                style={{ animationDelay: `${index * 260}ms` }}
              />
              <span
                className="h-2 w-2/3 animate-build-line rounded-full bg-border-strong/60"
                style={{ animationDelay: `${index * 260 + 130}ms` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
