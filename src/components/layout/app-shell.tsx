import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageEnter } from "./page-enter";

type Width = "content" | "wide";

// Only used when there is no sidebar. With one, the content column is capped
// at max-w-content instead — the rail has already taken its width off the
// window, and what is left is what gets centred.
const widths: Record<Width, string> = {
  content: "max-w-3xl",
  wide: "max-w-6xl",
};

// The page frame. Knows about layout and nothing else — no trips, no domain.
//
// It exists because eight pages were each repeating "mx-auto max-w-4xl px-4
// py-10" and had already drifted apart (the trip page said max-w-4xl while its
// own loading skeleton said max-w-2xl). Width and rhythm are decided here.
//
// Phase D added the `sidebar` slot. Before it, every screen was a single
// centred column at every viewport width and nothing at all responded above
// 1024px — the app was a phone layout stretched across a desktop. The rail
// appears from lg up and the mobile bar hides itself at md, so the three
// presentations never overlap.
//
// The frame is two columns, and which of them is centred is the whole point.
// Until 2026-09-01 the rail and the content sat together inside one
// `mx-auto max-w-shell`, so at 1911px the rail floated 230px in from the right
// edge with white on both sides of the app. The rail is now a sibling of the
// centred box rather than a child of it: it is pinned to the window's inline
// edge and runs the full height, and only the content column is capped and
// centred inside whatever it leaves. The header moved inside that column with
// it — in the design the rail is the taller of the two and carries the
// wordmark, and the header starts where the rail ends.
//
// `nav` renders above the content: a navigation component is free to also
// place a fixed bar of its own, and being fixed, that bar is unaffected by
// where in the tree it sits.
//
// The bottom padding clears such a bar on phones, and the safe-area inset
// keeps it above the home indicator. That inset resolves to 0 unless the
// document opts in with viewportFit: "cover" — see src/app/layout.tsx.
export function AppShell({
  header,
  sidebar,
  nav,
  // Full-bleed chrome above the content — today, the trip's light band.
  //
  // A slot rather than just the first child, and the two-pane layout below is
  // why. The band reaches the viewport edge with negative margins that cancel
  // this component's own padding; dropped inside a grid column it would bleed
  // sideways into the pane next to it instead of off the screen. Rendered here
  // it is always full width, whatever the columns underneath are doing.
  banner,
  width = "wide",
  children,
}: {
  header?: ReactNode;
  sidebar?: ReactNode;
  nav?: ReactNode;
  banner?: ReactNode;
  width?: Width;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      {sidebar && (
        // Full height, from the very top of the window: the rail is beside the
        // header rather than under it, and it stops at the bottom of the
        // viewport rather than of the document.
        <div className="sticky top-0 hidden h-dvh w-sidebar shrink-0 lg:block">
          {sidebar}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {header}

        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col",
            sidebar ? "max-w-content" : widths[width],
          )}
        >
          {/* No top padding of its own. A navigation component is free to render
              nothing in the flow — the phone bar is `fixed` and the pill row is
              `hidden` outside md–lg — and a wrapper with `pt-4` was then 16px of
              dead space above every screen at every width but one.
              Measured on the map tab at 375: the app bar ended at 56 and the map
              began at 72, so a screen whose whole point is reaching the bar had a
              grey strip under it. The padding belongs to the pill row, which is
              the only thing here that is ever in the flow. */}
          {nav && <div className="w-full px-4 md:px-6 lg:px-8">{nav}</div>}

          <main
            className={cn(
              "flex w-full flex-1 flex-col px-4 pt-5 md:px-6 lg:px-8",
              nav
                ? // 6rem, not 5: the phone bar floats now, so its own inset
                  // counts on top of its height. Measured at 375px — the bar is
                  // 80px tall and its top sits 92px above the viewport bottom,
                  // so it needs 5.75rem. The old 5rem left the last row of a
                  // list 12px behind the glass.
                  "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12"
                : "pb-12",
            )}
          >
            {/* Everything a page renders arrives through here, one block at a
                time. The banner is inside it rather than above it, so the
                trip's light is the first thing that appears and the content
                follows it — see page-enter.tsx and `.enter-children`.
                `gap-6` moved on to it with the children. */}
            <PageEnter>
              {banner}
              {children}
            </PageEnter>
          </main>
        </div>
      </div>
    </div>
  );
}
