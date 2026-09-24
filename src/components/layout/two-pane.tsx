import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// A main column with an optional context pane beside it.
//
// v5 made this respond to its *container*, not the viewport. It used to split
// at xl (1280px of window), which was right when the content column was the
// window minus a rail. Inside the workspace panel it is not: at 1440px the
// panel is about 800px wide, and a viewport query happily cut that into a
// 400px main column and a 372px pane. `@4xl` (56rem = 896px of container) is
// the narrowest width at which both columns still hold what they draw — the
// 660px card grid and the 372px pane. Whoever renders this puts `@container`
// on the scrolling column (AppShell's main, TripWorkspace's panel).
//
// PN20 (Pencil tablet): `split="early"` also splits a tablet. From `@2xl`
// (672px of container — a 768 portrait iPad after its 40px gutters) the pane is
// a 15.5rem column, and from `@5xl` it widens to the desktop's 23.25rem. For a
// pane that holds something glanceable (the day's map), not a second form.
export function TwoPane({
  children,
  aside,
  split = "wide",
}: {
  children: ReactNode;
  aside?: ReactNode;
  split?: "wide" | "early";
}) {
  if (!aside) {
    return (
      <div className="enter-skip enter-children mx-auto flex w-full min-w-0 max-w-main flex-col gap-6">
        {children}
      </div>
    );
  }

  const early = split === "early";

  return (
    <div
      className={cn(
        "enter-skip grid min-w-0 gap-6",
        early
          ? "@2xl:grid-cols-[minmax(0,1fr)_15.5rem] @2xl:gap-5 @5xl:grid-cols-[minmax(0,1fr)_23.25rem] @5xl:gap-6"
          : "@4xl:grid-cols-[minmax(0,1fr)_23.25rem]",
      )}
    >
      <div
        className={cn(
          "enter-children flex min-w-0 flex-col gap-6",
          early ? "@5xl:max-w-main" : "@4xl:max-w-main",
        )}
      >
        {children}
      </div>
      <aside
        className={cn(
          "enter-children flex min-w-0 flex-col gap-4",
          early
            ? "@2xl:sticky @2xl:top-16 @2xl:self-start"
            : "@4xl:sticky @4xl:top-0 @4xl:self-start",
        )}
      >
        {aside}
      </aside>
    </div>
  );
}
