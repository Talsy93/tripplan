"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The swipe-and-hold half of "destructive actions do not sit at rest".
//
// The design's rule is blunt — "פעולות הרסניות לא יושבות במנוחה... לא כאייקון
// בשורה שגוללים לידה" — and its answer is swipe and long-press. That answer is
// complete only for a finger. A mouse cannot swipe and a keyboard cannot hold, so
// this component covers the finger and the row covers the rest:
//
//   this        drag the row toward its inline start past the threshold, or hold
//               it still; a tinted panel is uncovered as the row moves
//   the caller  a button inside the row, invisible at rest and revealed by
//               `group-hover/swipe` / `focus-visible` — which is not "at rest"
//               either, and is the only affordance a pointer or a Tab can use
//
// It was briefly the other way round: this component owned a real button under
// the row and slid the row aside on hover to uncover it. Measured on the packing
// list, that was worse than the icon it replaced — the row slides toward its
// inline start, the wrapper clips, and the checkbox at the start of every gear row
// vanished the moment the pointer touched it. The gesture may clip the start of a
// row, because that is what the finger asked for. A hover may not.
//
// So the panel here is `aria-hidden` and not focusable: it is the picture of the
// gesture, not a control. Nothing is added to the tab order and nothing is
// covered at rest.
//
// Pointer events rather than touch events: one code path covers finger and pen,
// and mouse is filtered out by `pointerType` — a mouse drag on a list row is not
// a gesture anybody expects.
//
// Domain-free. It is handed an icon and a callback; it does not know whether it
// is removing a booking or a packing-list line.

// How far the row has to be dragged before letting go commits, and how wide the
// panel it uncovers is. 72px is a deliberate choice rather than a tuned one: it
// is wider than a thumb, so a scroll that wobbles sideways cannot reach it, and
// it is short enough that the gesture does not feel like dragging the row off the
// screen.
const COMMIT_PX = 72;
// Past this the row stops following the finger. Without a cap a long drag pulls
// the content clean out of its own card.
const MAX_PX = 96;
// A press this long with no movement counts as a hold. 550ms is above the
// threshold where a slow tap reads as a hold and below where a deliberate hold
// starts to feel broken.
const HOLD_MS = 550;
// A press that moves this far is a scroll or a drag, not a hold.
const HOLD_SLOP_PX = 8;

export function SwipeAction({
  icon,
  onAction,
  disabled = false,
  children,
  className,
}: {
  // Drawn on the panel the gesture uncovers. Decorative: the row's own button
  // carries the accessible name.
  icon: ReactNode;
  onAction: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  // How far the row is currently dragged, in px, always >= 0 — a distance toward
  // the inline start rather than a signed x. Which physical direction that is
  // belongs to CSS, not to this number: the row is offset with
  // `inset-inline-end`, so the same value is correct in RTL and in LTR.
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  // +1 when a rightward drag moves the row toward its inline start, i.e. RTL.
  // Read off the element on press rather than assumed: a `translateX` sign
  // hard-coded for one direction was the first version of this, and in an RTL
  // document it moved the row the wrong way and uncovered nothing.
  const toStart = useRef(1);
  // Whether a press is in progress. This used to be `hasPointerCapture`, which is
  // the same fact only as long as the capture succeeded — and when it does not,
  // every move is dropped and the row simply refuses to follow the finger. A ref
  // cannot fail, and the capture below is now best-effort.
  const active = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);

  function clearHold() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function settle() {
    clearHold();
    active.current = false;
    setOffset(0);
    setDragging(false);
  }

  function commit() {
    settle();
    onAction();
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "mouse") return;
    startX.current = event.clientX;
    moved.current = false;
    // The element first, the document as the fallback. `getComputedStyle` on an
    // element that is detached or unrendered returns empty strings, and reading
    // that as "not rtl" is how the reveal silently flips to LTR and uncovers
    // nothing — measured, in this app, while the tree was being replaced.
    const dir =
      getComputedStyle(event.currentTarget).direction ||
      getComputedStyle(document.documentElement).direction;
    toStart.current = dir === "rtl" ? 1 : -1;
    active.current = true;
    // Best-effort: capture keeps a drag that wanders off the row finishing here,
    // but it is an improvement on plain bubbling, not a precondition.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // No capture available. The gesture still works, it just ends early if the
      // finger leaves the row.
    }
    holdTimer.current = setTimeout(() => {
      if (!moved.current) commit();
    }, HOLD_MS);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "mouse") return;
    if (!active.current) return;

    const dx = event.clientX - startX.current;
    if (Math.abs(dx) > HOLD_SLOP_PX) {
      moved.current = true;
      clearHold();
    }
    // Only toward the start. Dragging the other way does nothing rather than
    // revealing a second action nobody asked for.
    const next = Math.max(0, Math.min(MAX_PX, dx * toStart.current));
    if (next !== 0) setDragging(true);
    setOffset(next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "mouse") return;
    active.current = false;
    if (offset >= COMMIT_PX) {
      commit();
      return;
    }
    settle();
  }

  return (
    <div
      className={cn(
        "group/swipe relative isolate overflow-hidden rounded-card",
        className,
      )}
    >
      {/* The picture of the gesture, uncovered as the row moves off it. Not a
          button and not in the tab order — the row's own control is. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 end-0 z-0 flex w-18 items-center justify-center",
          "bg-danger-tint text-danger-ink transition-opacity duration-settle",
          offset === 0 ? "opacity-0" : "opacity-100",
        )}
      >
        {icon}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // `inset-inline-end` rather than a transform, so the direction of the
        // reveal is the document's rather than a sign this component has to
        // guess. Set only while a finger is down; at rest the class below owns
        // the position.
        style={dragging ? { insetInlineEnd: `${offset}px` } : undefined}
        className={cn(
          // z-10 and an opaque background so the panel is only ever seen through
          // the space the row has vacated.
          //
          // `h-full` passes a stretched height through to the child. Without it a
          // card wrapped here stops matching its neighbours: the wrapper stretches
          // to the grid row and the card inside measures 100% of an auto-height
          // div instead — 218px against 196px, measured on the bookings grid. On a
          // list row, whose wrapper has no height of its own, it resolves to auto
          // and changes nothing.
          "relative z-10 end-0 h-full bg-surface",
          // No transition while the finger is down: the row has to track it
          // exactly. The snap back afterwards is animated.
          dragging
            ? undefined
            : "transition-[inset-inline-end] duration-settle ease-snap",
          // touch-action so a vertical scroll still scrolls the page — without it
          // the browser hands us every gesture and the list stops scrolling.
          "touch-pan-y",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// The class list a caller's destructive button needs to be revealed rather than
// resting: invisible until the row is hovered or the button itself is focused.
//
// Exported as a constant rather than left to each caller, because getting it
// wrong in one place is how a red X ends up sitting in a row again. `opacity`
// rather than `hidden`: the button keeps its space in the row, so revealing it
// does not reflow the line the pointer is aiming at.
export const REVEALED_ACTION =
  "opacity-0 transition-opacity duration-settle group-hover/swipe:opacity-100 focus-visible:opacity-100";
