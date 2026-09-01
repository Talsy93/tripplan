"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "../domain/trip";
import { phaseLabel } from "../domain/trip-days";
import type { Trip } from "../domain/trip";
import type { TripPhase } from "../domain/trip-days";

// The rail's trip switcher — a real one.
//
// It used to be a `<Link href="/profile">` wearing a `ChevronDown`, and the
// comment defending that said a menu "would have to load every trip into a
// layout that currently loads none of them for this". That was wrong on the
// facts: the tabs layout already calls `listTrips()` for the aura assignment, so
// every trip's name is in hand before this renders. A chevron that points down
// and navigates away instead of opening is a control lying about what it does,
// and it read as "the rail only knows the trip I am in".
//
// The chevron opens a list now. `/profile` is still reachable — the wordmark
// above goes there, and so does the last row here, which is the one thing this
// list cannot do.

export function RailTripSwitcher({
  name,
  phase,
  trips,
  currentId,
}: {
  name: string;
  phase: TripPhase;
  // Every trip the signed-in person has — exactly what `listTrips()` returns,
  // unmapped. Both callers already hold that array for the aura assignment,
  // and taking the domain type means neither has to reshape it.
  trips: Trip[];
  currentId: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Escape closes, and a click anywhere outside closes. Both on `document`
  // rather than on a backdrop element: a backdrop over the rail would sit
  // between the aura and the items and swallow the hover states underneath it.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    // Capture, so a click on something that stops propagation still closes it.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // Whatever order listTrips returned, unfiltered. There was an archived-last
  // split here; archiving is gone.
  const ordered = trips;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full min-w-0 items-center gap-2 rounded-control border border-white/20 bg-white/12 px-3 py-2.5 text-start text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-caption font-semibold text-white/65">
            {phaseLabel(phase)}
          </span>
          {/* truncate, not wrap: the rail is 15.5rem and a two-line trip name
              would push the first nav item down by its own height. The full name
              is in the app bar at the top of the same screen. */}
          <span className="block min-w-0 truncate text-sm font-bold">{name}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/60 transition-transform duration-settle ease-snap",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          // z-20 so it clears the nav items below it, which are `relative` to
          // sit above the aura field. Opaque, not glass: this is a menu of names
          // to read, and eight palettes of moving light behind text is the one
          // thing translucency here would cost.
          className="absolute inset-x-0 top-full z-20 mt-1 origin-top animate-pop overflow-hidden rounded-card border border-border bg-surface shadow-lift"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {ordered.map((trip) => {
              const isCurrent = trip.id === currentId;
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}/today`}
                    onClick={() => setOpen(false)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "flex min-w-0 items-center gap-2 px-3 py-2 text-start transition-colors",
                      "hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2",
                      isCurrent && "bg-surface-2",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isCurrent ? "text-success-ink" : "text-transparent",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block min-w-0 truncate text-sm font-semibold">
                        {trip.name}
                      </span>
                      <span className="block min-w-0 truncate text-caption text-muted">
                        {dateLine(trip)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* The one thing the list above cannot do. Separated by a rule rather
              than styled as another row, because it goes somewhere else. */}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-sm font-semibold text-primary-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
          >
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
            כל הטיולים שלי
          </Link>
        </div>
      )}
    </div>
  );
}

// Dates only, and deliberately not a phase. A phase needs the trip's day count,
// which is one query per trip — eight trips in a dropdown is not worth eight
// queries, and "24.9–7.10" is the fact somebody scanning a list of trips is
// looking for anyway.
function dateLine(trip: Trip): string {
  if (trip.start_date && trip.end_date) {
    return `${formatShortDate(trip.start_date)}–${formatShortDate(trip.end_date)}`;
  }
  if (trip.start_date) return `מ-${formatShortDate(trip.start_date)}`;
  return "בלי תאריכים";
}
