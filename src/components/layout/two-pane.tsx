import type { ReactNode } from "react";

// A screen's content beside its context.
//
// The phone puts five things behind five tabs because it has room for one at a
// time. A desktop has room for two, and the second one is not "more of the
// same" — it is the thing you would otherwise switch tabs to glance at and then
// switch back from. Putting it in a pane removes the round trip.
//
// A component a page renders rather than a slot on AppShell, and that is forced
// rather than chosen: AppShell is rendered by the layout, and in App Router a
// page cannot pass props up to its own layout. The split belongs to the page
// anyway — only the page knows what its own context is.
//
// Safe to use only below a full-bleed banner, never beside one: an element that
// cancels the shell's padding with negative margins would run sideways into the
// pane instead of off the screen. AppShell's `banner` slot exists for exactly
// that reason.
export function TwoPane({
  children,
  aside,
}: {
  children: ReactNode;
  // Optional, because a screen can be in a state where the pane has nothing to
  // say — a trip two months out has no forecast and may have no costs yet. An
  // empty 372px strip beside the content is worse than no strip: it reads as
  // something that failed to load.
  aside?: ReactNode;
}) {
  // One column, centred in the content area rather than pinned to its start
  // edge. Left at the start, the 660px measure would sit against the rail with
  // 520px of white beside it at 1920 — the same lopsided void this whole pass
  // is about, one level in.
  if (!aside) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-main flex-col gap-6">
        {children}
      </div>
    );
  }

  return (
    // xl, not lg. At 1024 the rail has already taken 15.5rem, and a 23.25rem
    // pane on top of it would leave the main column narrower than a phone's
    // content at a desktop's type size. Below xl the pane's contents simply
    // follow the main column, which is where they were before this existed — so
    // nothing is hidden at any width, it only moves.
    // 23.25rem spelled out rather than var(--container-pane): the container
    // tokens live in an `@theme inline` block, which means Tailwind substitutes
    // them into utilities and never emits them as custom properties — a var()
    // here would resolve to nothing. `max-w-pane` reads the same token through
    // a utility and does work; a grid template has no utility to read it.
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_23.25rem]">
      {/* Capped at 660px, but only from xl — the width the pane appears at.
          Below that there is one column and it should fill: measured at 768,
          an unguarded cap left 45px of dead space at the end of every row,
          which reads as an accidental indent rather than as a measure. */}
      <div className="flex min-w-0 flex-col gap-6 xl:max-w-main">{children}</div>
      {/* Sticky at top-20: AppHeader is 3.5rem and the content starts 1.25rem
          below it, so 5rem clears both. self-start is what lets a short pane
          stop rather than stretching to the main column's height — without it
          `sticky` has nothing to move within. */}
      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        {aside}
      </aside>
    </div>
  );
}
