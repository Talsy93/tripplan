import type { CSSProperties, ReactNode } from "react";
import { PageEnter } from "@/components/layout";

// The frame of a trip in the Stitch design (v6, "Mediterranean Horizon").
//
//   phone / tablet:  [ header ] content column [ tab bar pinned to the bottom ]
//   desktop (lg+):   [ rail 88 ][ header / content column, centred ]
//
// The v5 frame made the map the canvas and the tabs a sheet over it. Stitch
// has no canvas: a screen is a column of cards, and the map is one of them —
// on "מסלול", above the timeline, with a button to open it full-screen. So the
// map left the frame, and with it the one expensive read every tab paid for.
//
// `@container` on the column lets TwoPane and the card grids inside answer to
// the column's width, not the window's.
export function TripWorkspace({
  rail,
  header,
  tabs,
  hueStyle,
  children,
}: {
  rail: ReactNode;
  header: ReactNode;
  tabs: ReactNode;
  // No longer drawn — see above. Accepted so older callers keep compiling.
  map?: ReactNode;
  // The trip's light, published as CSS variables for the panels that read it.
  hueStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-rail shrink-0 lg:block">
        {rail}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {header}

        <main
          className="@container mx-auto w-full max-w-[66rem] flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:px-6 lg:px-8 lg:pb-12"
          style={hueStyle}
        >
          <PageEnter>{children}</PageEnter>
        </main>
      </div>

      {tabs}
    </div>
  );
}
