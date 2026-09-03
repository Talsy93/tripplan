"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatShortDate } from "../domain/trip";
import { standingLabel } from "../domain/trip-order";
import type { StandingTrip } from "../domain/trip-order";

// The trips as a deck you slide through, one in focus at a time.
//
// Chosen over the legend list it replaces. The reservation stands and is worth
// leaving written down rather than quietly dropping: a deck puts most of its
// content past the edge of the screen, which is the same thing that was
// reported about the rail a few days ago. Three mitigations below exist only
// because of that, and none of them make it untrue.
//
// What the deck buys in exchange is that every trip gets a card big enough to
// carry its own light, and that sliding is a better motion on a phone than
// scanning a list — the two things a legend row cannot do.

// Which card is centred, worked out from geometry rather than from an
// IntersectionObserver.
//
// IO is the obvious tool and it is the wrong one here. Detecting "the middle
// one" with IO needs a rootMargin that shrinks the root to a thin band, and in
// a horizontally scrolled RTL container those percentages resolve against an
// axis whose origin flips — it works in one direction and silently never fires
// in the other. Measuring distance from the container's centre asks the
// question directly and has no direction at all.
function centredIndex(scroller: HTMLElement): number {
  const box = scroller.getBoundingClientRect();
  const middle = box.left + box.width / 2;
  let best = 0;
  let bestDistance = Infinity;

  for (let index = 0; index < scroller.children.length; index += 1) {
    const child = scroller.children[index] as HTMLElement;
    const rect = child.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

export function TripsDeck({
  entries,
  auraByTrip,
  locatedIds,
  onFocus,
}: {
  entries: StandingTrip[];
  auraByTrip?: Map<string, string[]>;
  // Which trips the map can actually place. A card for a trip the map does not
  // know still exists and still slides into focus — it simply does not move
  // the map, and says so.
  locatedIds?: Set<string>;
  onFocus?: (tripId: string | null) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const frame = useRef<number | null>(null);

  const sync = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Nothing to centre.
    //
    // On a wide screen every card fits and the deck does not scroll, and then
    // "the centred card" is not a choice anybody made — it is wherever the row
    // happens to end. Measured at 1280: four cards fill the width and the third
    // one lands nearest the middle, so the map would fly to a trip the reader
    // never picked. When the deck cannot scroll, the dots are the only way to
    // change focus and whatever they last set is left alone.
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Coalesced to one read per frame. A scroll handler that measures every
    // child on every event is the classic way to make a smooth gesture stutter,
    // and this one measures N children.
    frame.current = requestAnimationFrame(() => {
      setActive(centredIndex(scroller));
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // A ResizeObserver, not a single call on mount.
    //
    // The mount-only version was wrong and measurably so: it ran before the web
    // font had settled the card widths, read a layout that no longer existed a
    // frame later, and — with no scrolling to trigger it again — never
    // corrected. It also has to re-run when the window changes, because that is
    // what moves the deck between scrollable and not.
    const observer = new ResizeObserver(() => sync());
    observer.observe(scroller);
    sync();

    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [sync]);

  useEffect(() => {
    onFocus?.(entries[active]?.trip.id ?? null);
  }, [active, entries, onFocus]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollerRef}
        onScroll={sync}
        // snap-mandatory with a centre alignment: a card always ends up in the
        // middle, which is what makes "the centred one" a state worth reading
        // rather than a coincidence of where the finger stopped.
        //
        // The horizontal padding is half the container minus half a card, so
        // the first and last cards can reach the centre too. Without it the
        // outer trips can never be focused, which on a two-trip account means
        // the feature does not work at all.
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: "50%" }}
      >
        {entries.map(({ trip, phase }, index) => {
          const hue = auraByTrip?.get(trip.id)?.[0];
          const on = index === active;
          const located = locatedIds?.has(trip.id) ?? false;
          const during = phase.kind === "during";

          return (
            <article
              key={trip.id}
              className={cn(
                "relative flex w-64 shrink-0 snap-center flex-col justify-between gap-3 overflow-hidden rounded-card p-4 transition-transform duration-settle ease-snap",
                "bg-aura-base text-white",
                on ? "scale-100" : "scale-95",
              )}
            >
              {/* The trip's light, as the card's own ground. A flat wash rather
                  than the full AuraField: three drifting blooms on eight cards
                  is the case that component's own comment warns about, and at
                  this size the drift is not visible anyway. */}
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={
                  hue
                    ? {
                        background: `radial-gradient(120% 100% at 15% 0%, ${hue} 0%, transparent 70%)`,
                        opacity: on ? 0.55 : 0.3,
                      }
                    : undefined
                }
              />

              <div className="relative flex flex-col gap-0.5">
                <span className="text-caption font-medium text-white/70">
                  {during ? "בטיול עכשיו" : standingLabel(phase)}
                </span>
                {/* Two lines maximum. A card is a label, and the full name is
                    the title of the screen it opens. */}
                <Link
                  href={`/trips/${trip.id}`}
                  className="line-clamp-2 text-lg font-semibold wrap-anywhere after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-white"
                >
                  {trip.name}
                </Link>
              </div>

              <div className="relative flex items-baseline justify-between gap-2 text-caption text-white/70">
                <span className="tabular-nums">
                  {trip.start_date ? formatShortDate(trip.start_date) : "בלי תאריך"}
                </span>
                {/* Says why the map did not move, instead of leaving it looking
                    broken. A trip with no located city is normal — it just has
                    not been opened on the map tab yet. */}
                {!located && <span>לא על המפה</span>}
              </div>
            </article>
          );
        })}
      </div>

      {/* The three mitigations for what a deck costs, and they are the whole
          reason this row exists.

          A deck hides most of itself past the edge — the exact complaint made
          about the rail. It cannot be undone, so it is at least made visible:
          the count says how many there are, the position says where you are in
          them, and the dots give a target to jump with. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-caption tabular-nums text-muted">
          {active + 1} מתוך {entries.length}
        </span>
        <div className="flex items-center gap-1.5">
          {entries.map(({ trip }, index) => (
            <button
              key={trip.id}
              type="button"
              aria-label={trip.name}
              aria-current={index === active}
              onClick={() => {
                // Set directly as well as scrolling. When the deck fits its
                // container there is nothing to scroll, scrollIntoView is a
                // no-op, and without this the dots would do nothing at all on a
                // desktop — which is exactly how they were found to behave.
                setActive(index);
                const child = scrollerRef.current?.children[index] as
                  | HTMLElement
                  | undefined;
                child?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "auto"
                    : "smooth",
                  inline: "center",
                  block: "nearest",
                });
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-settle ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === active
                  ? "w-5 bg-foreground"
                  : "w-2 bg-border-strong hover:bg-muted",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
