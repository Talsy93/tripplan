import type { ReactNode } from "react";

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
export function TwoPane({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  if (!aside) {
    return (
      <div className="enter-skip enter-children mx-auto flex w-full min-w-0 max-w-main flex-col gap-6">
        {children}
      </div>
    );
  }

  return (
    <div className="enter-skip grid min-w-0 gap-6 @4xl:grid-cols-[minmax(0,1fr)_23.25rem]">
      <div className="enter-children flex min-w-0 flex-col gap-6 @4xl:max-w-main">
        {children}
      </div>
      <aside className="enter-children flex min-w-0 flex-col gap-4 @4xl:sticky @4xl:top-0 @4xl:self-start">
        {aside}
      </aside>
    </div>
  );
}
