import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Width = "content" | "wide";

const widths: Record<Width, string> = {
  content: "max-w-2xl",
  wide: "max-w-5xl",
};

// The page frame. Knows about layout and nothing else — no trips, no domain.
//
// It exists because eight pages were each repeating "mx-auto max-w-4xl px-4
// py-10" and had already drifted apart (the trip page said max-w-4xl while its
// own loading skeleton said max-w-2xl). Width and rhythm are decided here now.
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
  nav,
  width = "wide",
  children,
}: {
  header?: ReactNode;
  nav?: ReactNode;
  width?: Width;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}

      {nav && (
        <div className={cn("mx-auto w-full px-4 pt-4", widths[width])}>
          {nav}
        </div>
      )}

      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-5",
          nav
            ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12"
            : "pb-12",
          widths[width],
        )}
      >
        {children}
      </main>
    </div>
  );
}
