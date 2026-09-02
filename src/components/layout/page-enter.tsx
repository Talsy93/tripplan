"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The container that makes a page's content arrive one block at a time — on the
// first screen as it loads, and further down as it is scrolled to.
//
// The CSS half is `.enter-children` in globals.css. This file exists for two
// reasons, and the second is what makes the app feel alive rather than slow.
//
// **1. The animation has to re-run when the route changes.** A CSS animation
// runs once per element, when it is inserted. In the App Router a layout is not
// re-created when you move between the routes under it, so React reconciles the
// new page against the old one and reuses any DOM node of the same type in the
// same position. A reused node is not a new node, its animation does not
// restart, and the effect appears on some navigations and not others — all five
// trip tabs open with a `<div>`. Keying on the pathname makes each route its own
// subtree.
//
// **2. Blocks below the fold should not animate on load.** The load sequence is
// over in about 250ms, which means everything past the first screen used to
// animate where nobody could see it, and then sat there static for the rest of
// the visit. That is a page that plays a cutscene once. Marking those blocks and
// releasing them as they come into view is what keeps the screen answering while
// you move down it.
//
// The marking happens after mount rather than during render, and it has to: the
// server has no viewport, so there is no honest way to know at render time which
// blocks are below the fold. The consequence is that the CSS load sequence
// briefly starts on every child — including the ones about to be marked. That is
// invisible by definition, because those children are off-screen; it is the one
// place in this file where "nobody is looking" is a legitimate argument.

// How far into the viewport a block has to come before it is released. 12% of
// the screen, so a block announces itself as it arrives rather than after it has
// already been read.
const REVEAL_MARGIN = "0px 0px -12% 0px";

// Between siblings that cross the line together. Larger than the 28ms of the
// load sequence: on load the whole screen is arriving at once and speed is the
// point, here two or three cards are arriving and the sequence is the point.
const REVEAL_STEP_MS = 70;

export function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Someone who asked for no motion gets none of this: without the marking
    // every block is simply present, which is the correct reduced-motion answer
    // and also what the CSS block at the bottom of globals.css already does for
    // the load sequence.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Without an observer there is nothing to release a marked block, and a
    // block held at `opacity: 0` with no way out is content permanently
    // hidden. The load sequence alone is the correct fallback.
    if (!("IntersectionObserver" in window)) return;

    const pending: Element[] = [];
    for (const child of Array.from(root.children)) {
      // Fully below the viewport, not merely crossing it. A block that is half
      // read cannot be reset to `opacity: 0` — that is a visible jump, and the
      // one failure mode this whole mechanism could introduce.
      if (child.getBoundingClientRect().top >= window.innerHeight) {
        child.setAttribute("data-reveal", "pending");
        pending.push(child);
      }
    }
    if (pending.length === 0) return;

    // Batched per callback, so siblings that cross together get 0, 70, 140ms
    // rather than all landing on the same frame.
    const observer = new IntersectionObserver(
      (entries) => {
        let index = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.setProperty(
            "--reveal-delay",
            `${index * REVEAL_STEP_MS}ms`,
          );
          el.setAttribute("data-reveal", "shown");
          // Once shown, stop watching: this is an arrival, not a scroll effect
          // that replays every time the block passes the line.
          observer.unobserve(el);
          index += 1;
        }
      },
      { rootMargin: REVEAL_MARGIN },
    );

    for (const child of pending) observer.observe(child);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    // gap-6 rather than leaving it on <main>: this element is the flex container
    // its children live in, so the rhythm belongs to whichever one that is.
    <div
      key={pathname}
      ref={ref}
      className="enter-children flex w-full flex-col gap-6"
    >
      {children}
    </div>
  );
}
