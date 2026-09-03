"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatShortDate } from "../domain/trip";
import { standingLabel } from "../domain/trip-order";
import type { StandingTrip } from "../domain/trip-order";
import type { MappedTrip } from "./trips-map-canvas";

const TripsMapCanvas = dynamic(() => import("./trips-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

// Every trip on one map, with the list beside it as the legend.
//
// This replaces the compact grid, and the map is the smaller half of what it
// does. The grid answered "what do I have" as a set of tiles; this answers
// "where are they, and how far apart" — a question no list can be arranged to
// answer, and the reason the direction was worth building at all.
//
// **The legend is the list, not a key to the map.** That distinction is what
// keeps the instruction "I want all my trips shown, always" intact: a trip with
// no located city has no pin, and if the legend only described pins that trip
// would vanish from the screen entirely. So the legend is built from every
// trip, and the dot is what tells you whether the map knows where it is.
//
// It is also the only interactive part. The map is deliberately still — see
// trips-map-canvas — so the rows carry the links, which is better anyway: a
// 14px disc is not a tap target, and eight of them overlapping in Europe is
// not a menu.
export function TripsWorldMap({
  entries,
  auraByTrip,
  pointsByTrip,
  enterDelayMs = 0,
}: {
  // Already ordered by proximity, the same order every other tier uses.
  entries: StandingTrip[];
  auraByTrip?: Map<string, string[]>;
  pointsByTrip?: Map<
    string,
    { city: string; latitude: number; longitude: number }[]
  >;
  enterDelayMs?: number;
}) {
  const mapped: MappedTrip[] = entries.flatMap((entry) => {
    const points = pointsByTrip?.get(entry.trip.id) ?? [];
    if (points.length === 0) return [];
    return [
      {
        id: entry.trip.id,
        name: entry.trip.name,
        // The lead hue of the palette this trip was assigned. Falls back to the
        // action blue rather than to nothing: a trip with located cities but no
        // light is a trip whose cities were never saved as destinations, and a
        // transparent pin would be a bug that looks like a missing trip.
        hue: auraByTrip?.get(entry.trip.id)?.[0] ?? "var(--primary)",
        points,
      },
    ];
  });

  return (
    // minmax(0,…) on both tracks, not a bare 1.5fr/1fr.
    //
    // `1fr` is `minmax(auto, 1fr)`, and `auto` floors the track at its
    // min-content width. The legend holds user-authored trip names, one of
    // which in the fixtures has no break opportunity at all, so that floor was
    // 602px inside a 557px column — measured. The map track was starved to 2px
    // and the legend overflowed sideways into the pane beside it.
    //
    // The same class of bug the html { overflow-x: clip } backstop in
    // globals.css exists to make non-fatal, fixed here at its source: a zero
    // minimum lets the track shrink and the `truncate` inside finally do its
    // job.
    // A container query, not a breakpoint.
    //
    // `lg:` asks how wide the *window* is, and this component does not live in
    // the window — it lives in TwoPane's main column, which is capped and has a
    // 372px pane beside it. Measured at a 1280px viewport that column is 557px,
    // so a viewport-driven two-column split gave the map 327px and the legend
    // 218px, and every trip name truncated to nothing.
    //
    // @2xl is 42rem of the container, so the split happens when there is
    // actually room for it and the section stacks the rest of the time — map
    // full width, names at full length underneath.
    <div className="@container">
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* The map only when there is something on it. With nothing located this
          would be a grey rectangle centred on the Atlantic, which says the app
          is broken rather than that the trips have not been placed yet — the
          same call the hero makes when it falls back to the light. */}
        {mapped.length > 0 && (
          <div className="h-64 overflow-hidden rounded-card border border-border @2xl:h-auto @2xl:min-h-72">
            <TripsMapCanvas trips={mapped} />
          </div>
        )}

        <ul
          className={cn(
            "stagger flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-2",
            mapped.length === 0 && "@2xl:col-span-2",
          )}
          style={
            enterDelayMs > 0
              ? ({
                  "--stagger-base": `${enterDelayMs}ms`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {entries.map(({ trip, phase }) => {
            const located = (pointsByTrip?.get(trip.id)?.length ?? 0) > 0;
            const hue = auraByTrip?.get(trip.id)?.[0];
            const active = phase.kind === "during";

            return (
              <li key={trip.id} className="min-w-0 animate-rise">
                <Link
                  href={`/trips/${trip.id}`}
                  className={cn(
                    "flex min-w-0 items-center gap-2.5 rounded-control px-2.5 py-2 transition-colors",
                    "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-surface-2",
                  )}
                >
                  {/* Filled when the map knows where the trip is, hollow when it
                    does not. The same shape either way, so the row still reads
                    as one of a set rather than as an error. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      !located && "border-2 border-border-strong",
                    )}
                    style={located && hue ? { background: hue } : undefined}
                  />

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="min-w-0 truncate text-sm font-semibold">
                      {trip.name}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 truncate text-caption",
                        active ? "font-bold text-primary-ink" : "text-muted",
                      )}
                    >
                      {standingLabel(phase)}
                    </span>
                  </span>

                  <span className="shrink-0 text-caption tabular-nums text-muted">
                    {trip.start_date ? formatShortDate(trip.start_date) : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
