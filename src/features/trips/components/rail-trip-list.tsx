import Link from "next/link";
import { cn } from "@/lib/cn";
import { standingLabel } from "../domain/trip-order";
import type { StandingTrip } from "../domain/trip-order";

// Every trip, jumpable, from the home screen's rail.
//
// The rail used to carry exactly one: the featured trip, as a single nav item
// with a back arrow. Reported as "I only see Italy" — and it was a fair
// complaint about a rail, because the rail inside a trip has had a real
// switcher for a while (see rail-trip-switcher.tsx) and the home screen's did
// not. The one screen whose whole subject is *which trip*, with the least way
// to choose one.
//
// Not the switcher itself, and the difference is the point. That control exists
// to say "you are in this trip, here are the others" — it needs a current trip,
// a phase for its closed state, and a chevron that implies leaving where you
// are. On the home screen you are not in a trip; there is nothing to be current
// and nothing to switch away from. This is a list, always open, because there is
// no state here worth a disclosure.
//
// Ordered by proximity by the caller, not here: the page already sorted the
// whole screen that way and a second sort would be a second opinion.
export function RailTripList({ entries, className }: {
  entries: StandingTrip[];
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 pt-4", className)}>
      {/* A label rather than another nav item. "הטיולים שלי" above already goes
          to the full screen, and a second row saying almost the same thing
          would read as two ways to the same place. */}
      <span className="px-3 pb-1 text-caption font-bold uppercase tracking-latin text-white/45">
        קפיצה לטיול
      </span>

      {/* No cap. The rail is the one place the answer to "where are my trips"
          has to be complete — "אני רוצה שכל הטיולים שלי יוצגו, תמיד" is the
          same instruction that removed the archive, and a rail that shows the
          first six is the archive again under a nicer name. SideNav's own
          `overflow-y-auto` is what makes twenty of them survivable. */}
      <ul className="flex flex-col gap-0.5">
        {entries.map(({ trip, phase }) => {
          const active = phase.kind === "during";
          return (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}/today`}
                className={cn(
                  "flex min-w-0 flex-col rounded-control px-3 py-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base",
                  active
                    // The trip being lived is marked here the way it is
                    // everywhere else on this screen — it gets the weight, and
                    // it is the one row that keeps it while resting. Not the
                    // solid white of a selected nav item: nothing in this list
                    // is the current page, and white would claim it was.
                    ? "bg-white/15 text-white hover:bg-white/20"
                    : "text-white/75 hover:bg-white/12 hover:text-white",
                )}
              >
                {/* truncate for the same reason the switcher truncates: the
                    rail is a fixed 15.5rem and a wrapped trip name pushes
                    everything under it down by its own height. */}
                <span className="min-w-0 truncate text-sm font-semibold">
                  {trip.name}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate text-caption",
                    active ? "text-white/80" : "text-white/50",
                  )}
                >
                  {standingLabel(phase)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
