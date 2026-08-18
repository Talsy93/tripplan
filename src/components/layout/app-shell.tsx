import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Width = "content" | "wide";

// Only used when there is no sidebar. With one, the content pane simply fills
// what the rail leaves and the whole frame is capped at max-w-shell instead.
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
  width = "wide",
  children,
}: {
  header?: ReactNode;
  sidebar?: ReactNode;
  nav?: ReactNode;
  width?: Width;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}

      <div
        className={cn(
          "mx-auto flex w-full flex-1",
          sidebar ? "max-w-shell" : widths[width],
        )}
      >
        {sidebar && (
          // h-14 is AppHeader's height; the rail has to start below it and
          // stop at the bottom of the viewport, not of the document.
          <div className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-sidebar shrink-0 lg:block">
            {sidebar}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {nav && (
            <div className="w-full px-4 pt-4 md:px-6 lg:px-8">{nav}</div>
          )}

          <main
            className={cn(
              "flex w-full flex-1 flex-col gap-6 px-4 pt-5 md:px-6 lg:px-8",
              nav
                ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12"
                : "pb-12",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
