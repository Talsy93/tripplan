import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { daysUntil } from "../domain/trip";
import { phaseLabel } from "../domain/trip-days";
import type { TripPhase } from "../domain/trip-days";

// The two ends of the desktop rail.
//
// The rail already carries the trip's colour; these say which trip in words, and
// where it is in its own life. Both are things a phone gets from the band at the
// top of every screen — and the rail is what a desktop has instead of that band
// being the first thing under your thumb.
//
// Split into two exports rather than one component because SideNav takes them as
// separate slots: the switcher pins to the top and the progress sits on the
// bottom edge, and anything between them is the navigation itself.

export function RailTripSwitcher({
  name,
  phase,
}: {
  name: string;
  phase: TripPhase;
}) {
  return (
    // A link to the trips list, not a dropdown. A menu here would be a second
    // way to do the one thing /profile already does well, and it would have to
    // load every trip into a layout that currently loads none of them for this.
    <Link
      href="/profile"
      className="flex min-w-0 items-center gap-2 rounded-control border border-white/20 bg-white/12 px-3 py-2.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-semibold text-white/65">
          {phaseLabel(phase)}
        </span>
        {/* truncate, not wrap: the rail is 15rem and a two-line trip name would
            push the first nav item down by its own height. The full name is in
            the app bar at the top of the same screen. */}
        <span className="block min-w-0 truncate text-sm font-bold">{name}</span>
      </span>
      <ChevronDown
        className="h-4 w-4 shrink-0 text-white/60"
        aria-hidden="true"
      />
    </Link>
  );
}

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
        <span className="text-heading font-black tabular-nums">{value}</span>
        <span className="text-caption font-semibold text-white/75">{unit}</span>
      </p>
      {fraction !== null && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/20"
          role="presentation"
        >
          <span
            className="block h-full rounded-full bg-white"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
