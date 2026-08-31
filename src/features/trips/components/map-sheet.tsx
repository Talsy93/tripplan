"use client";

import { useRef, useState, type ReactNode } from "react";

// The panel that sits over a full-bleed map.
//
// The map tab is the one screen where the content fills the viewport and the
// controls float on top of it, so its list of stops cannot sit below the map —
// there is no below. A sheet is how every map on a phone solves this, and the
// reason it works is that it answers two questions with one control: what are
// the stops, and let me see the map without losing them.
//
// Two positions, not free height. A sheet you can leave at any height is a sheet
// you can leave somewhere useless, and the two that matter are "one row visible,
// map mostly clear" and "list visible, map still there behind it". The handle
// toggles; a drag past a threshold also toggles, so the gesture people reach for
// works even though the sheet does not track the finger continuously.
//
// Deliberately not tracking the finger: following a pointer means owning
// momentum, rubber-banding at both ends, and cancelling a scroll that started
// inside the list. Snapping on release is a smaller thing that behaves the same
// way for the gesture people actually make.

type Position = "peek" | "open";

export function MapSheet({
  title,
  action,
  items,
  peekCount = 2,
}: {
  title: string;
  // The one link the header offers.
  action?: ReactNode;
  // Rendered rows, not a single node, and that is what makes the collapsed
  // state work: clipping a list to a pixel height cuts the last row through the
  // middle, which reads as a broken layout rather than as more-below. Taking
  // the first N whole rows cannot do that at any row height.
  items: ReactNode[];
  peekCount?: number;
}) {
  const [position, setPosition] = useState<Position>("peek");
  // Where the drag started. A ref rather than state: it changes on every pointer
  // move and nothing renders from it.
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);

  function toggle() {
    setPosition((current) => (current === "peek" ? "open" : "peek"));
  }

  function onPointerDown(event: React.PointerEvent) {
    startY.current = event.clientY;
    dragged.current = false;
  }

  function onPointerMove(event: React.PointerEvent) {
    if (startY.current === null) return;
    const delta = event.clientY - startY.current;
    // 28px, which is about a thumb's slop on a deliberate flick and well past
    // the few pixels a tap produces. Below it this is a tap, and the click
    // handler deals with it.
    if (Math.abs(delta) < 28) return;

    dragged.current = true;
    setPosition(delta < 0 ? "open" : "peek");
    startY.current = null;
  }

  function onPointerUp() {
    startY.current = null;
  }

  return (
    // Inset from three edges and clear of the floating tab bar, the same way the
    // bar itself is inset — the two are the only things on this screen that
    // float, and they have to read as one system.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] px-2 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden">
      <section
        aria-label={title}
        className="pointer-events-auto flex max-h-[60dvh] flex-col overflow-hidden rounded-tile bg-surface shadow-modal"
      >
        {/* The whole header is the control, not just the 38px bar inside it —
            a grab handle that only works when you hit the handle is a worse
            version of a button. */}
        <button
          type="button"
          onClick={() => {
            // A drag already decided; a click that follows it would undo it.
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            toggle();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-expanded={position === "open"}
          className="flex shrink-0 touch-none flex-col items-stretch gap-2.5 px-4 pb-2 pt-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="mx-auto h-1 w-9 shrink-0 rounded-full bg-border-strong"
          />
          <span className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-black">{title}</span>
            {action}
          </span>
        </button>

        {/* Not `hidden` when collapsed: the first rows stay visible at rest,
            which is what makes this a sheet rather than an accordion — you can
            see what is in it without opening it. */}
        <div
          className={
            position === "open"
              ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
              : "shrink-0 px-4 pb-3"
          }
        >
          {position === "open" ? items : items.slice(0, peekCount)}

          {position === "peek" && items.length > peekCount && (
            <p className="pt-1 text-caption text-muted">
              ועוד {items.length - peekCount}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
