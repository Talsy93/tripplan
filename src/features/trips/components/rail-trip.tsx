import { daysUntil } from "../domain/trip";
import type { TripPhase } from "../domain/trip-days";

// The bottom end of the desktop rail.
//
// The rail already carries the trip's colour; these say which trip in words, and
// where it is in its own life. Both are things a phone gets from the band at the
// top of every screen — and the rail is what a desktop has instead of that band
// being the first thing under your thumb.
//
// The switcher that used to live here moved to rail-trip-switcher.tsx when it
// stopped being a link and became a real menu — that needs client state, and
// this file has none.

export function RailTripProgress({
  phase,
  dayCount,
  startDate,
}: {
  phase: TripPhase;
  dayCount: number;
  startDate: string | null;
}) {
  // Three different sentences, because the number that matters changes with the
  // phase — days until you leave, day you are on, and nothing at all once it is
  // over. An "after" trip gets no progress bar: a finished trip is not 100%
  // done, it is simply finished, and a full bar reads as a task completed.
  if (phase.kind === "during") {
    const done = dayCount > 0 ? Math.min(phase.dayNumber / dayCount, 1) : 0;
    return (
      <Progress
        label={`יום ${phase.dayNumber} מתוך ${dayCount}`}
        value={String(dayCount - phase.dayNumber)}
        unit={dayCount - phase.dayNumber === 1 ? "יום נותר" : "ימים נותרו"}
        fraction={done}
      />
    );
  }

  if (phase.kind === "before" && startDate) {
    const left = daysUntil(startDate);
    if (left === null || left < 0) return null;
    return (
      <Progress
        label="עד היציאה"
        value={String(left)}
        unit={left === 1 ? "יום" : "ימים"}
        fraction={null}
      />
    );
  }

  return null;
}

function Progress({
  label,
  value,
  unit,
  fraction,
}: {
  label: string;
  value: string;
  unit: string;
  // null when there is nothing to be partway through.
  fraction: number | null;
}) {
  return (
    <div className="border-t border-white/15 px-3 pt-3 text-white">
      <p className="text-caption font-semibold text-white/65">{label}</p>
      <p className="flex items-baseline gap-1.5">
        {/* Static, deliberately. A count-up was built for this number and
            removed: the server renders the final figure, so the only way a
            client animation can start from zero is to overwrite it at
            hydration — measured as a visible 23 → 0 → 23 jump, which reads as
            a glitch rather than as the app working something out. The bar
            below fills instead, and a bar has no value to contradict. */}
        <span className="text-heading font-black tabular-nums">{value}</span>
        <span className="text-caption font-semibold text-white/75">{unit}</span>
      </p>
      {fraction !== null && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/20"
          role="presentation"
        >
          <span
            className="block h-full animate-fill rounded-full bg-white"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
