"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Snap = "peek" | "half" | "full";

// Sheet height per snap point, as a share of the viewport. `peek` leaves the
// map as the screen and shows just the tabs and the first row; `full` still
// leaves a strip of map visible so the sheet never reads as a new page.
const SNAPS: Record<Snap, number> = { peek: 0.3, half: 0.58, full: 0.9 };
const ORDER: Snap[] = ["peek", "half", "full"];

// The panel of a map workspace, in both of its presentations.
//
// Below lg it is a bottom sheet fixed over the map: drag the handle to move it
// between three snap points, or tap the handle to step through them. From lg up
// the same element is a column beside the map (`desktop="column"`) or a card
// floating over it (`desktop="floating"`), and the handle disappears. One DOM
// node for both, on purpose: the children are a route's page, and rendering
// them twice would mount every client component in them twice.
//
// Domain-free. It does not know what a trip or a tab is; `header` is whatever
// should stay pinned above the scrolling content (the segmented tabs).
export function BottomSheet({
  header,
  children,
  desktop = "column",
  initial = "half",
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  // `main`: the panel is the screen's main column and grows to fill what the
  // rail and a side pane leave. `column`: a fixed 440px column beside a canvas.
  // `floating`: a card over the canvas.
  desktop?: "main" | "column" | "floating";
  initial?: Snap;
  className?: string;
}) {
  const [snap, setSnap] = useState<Snap>(initial);
  // Height while a drag is in progress, in px. null = resting at `snap`.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  const viewport = () =>
    typeof window === "undefined" ? 800 : window.innerHeight;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      drag.current = {
        startY: event.clientY,
        startHeight: SNAPS[snap] * viewport(),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [snap],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.startHeight + (drag.current.startY - event.clientY);
    const max = SNAPS.full * viewport();
    const min = SNAPS.peek * viewport() * 0.6;
    setDragHeight(Math.min(max, Math.max(min, next)));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    const height = dragHeight ?? drag.current.startHeight;
    drag.current = null;
    setDragHeight(null);
    const share = height / viewport();
    // Nearest snap point wins; a short flick still moves one step because the
    // drag distance already pushed `share` past the midpoint.
    const nearest = ORDER.reduce((best, candidate) =>
      Math.abs(SNAPS[candidate] - share) < Math.abs(SNAPS[best] - share)
        ? candidate
        : best,
    );
    setSnap(nearest);
  }, [dragHeight]);

  // A tap on the handle steps up, and from full wraps back to peek — the map
  // is always one tap away.
  const step = () =>
    setSnap((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);

  // Keep the body from scrolling behind a sheet that is itself scrollable.
  useEffect(() => {
    if (snap !== "full") return;
    const media = window.matchMedia("(min-width: 64rem)");
    if (media.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [snap]);

  const style = {
    "--sheet-h":
      dragHeight !== null ? `${dragHeight}px` : `${SNAPS[snap] * 100}dvh`,
  } as CSSProperties;

  return (
    <section
      aria-label="לוח הטיול"
      style={style}
      className={cn(
        "flex min-h-0 flex-col bg-surface",
        // phone: the sheet
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-[var(--sheet-h)] max-lg:rounded-t-modal max-lg:border-t max-lg:border-border max-lg:shadow-modal",
        dragHeight === null && "max-lg:transition-[height] max-lg:duration-settle max-lg:ease-snap",
        // desktop: a column or a floating card
        desktop === "main" &&
          "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:min-w-0 lg:flex-1",
        desktop === "column" &&
          "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-panel lg:shrink-0 lg:border-e lg:border-border",
        desktop === "floating" &&
          "lg:absolute lg:bottom-4 lg:end-4 lg:top-4 lg:z-20 lg:w-panel lg:overflow-hidden lg:rounded-card lg:border lg:border-border lg:shadow-lift",
        className,
      )}
    >
      <button
        type="button"
        onClick={step}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={
          snap === "full" ? "הקטינו את הלוח והציגו את המפה" : "הגדילו את הלוח"
        }
        className="flex h-6 w-full shrink-0 touch-none items-center justify-center lg:hidden"
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-border-strong"
        />
      </button>

      {header && (
        <div className="shrink-0 border-b border-border bg-surface px-3 pb-2 pt-1 lg:px-4 lg:pt-3">
          {header}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
