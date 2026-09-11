import type { CSSProperties, ReactNode } from "react";
import { BottomSheet, PageEnter, SidePane } from "@/components/layout";

// The frame of a trip in the "מפה חיה" direction: one workspace with the
// panel as its main column and the map as a reference pane beside it.
//
//   desktop (lg+):  [ rail 64 ][ panel ····· flex ····· ][ map 352–480 ⇤ fold ]
//   phone:          map full-screen, the panel is a bottom sheet over it
//
// The first cut gave the map everything the panel did not take. That was the
// wrong ratio — the panel is where a traveller reads, picks and edits, and the
// map is what they glance at — so the panel is now the main column, capped at
// a comfortable reading width, and the map is a fixed-width pane that folds.
//
// The panel is one DOM node in both presentations — see BottomSheet — so a
// tab's page mounts once. `@container` on the scrolling column lets TwoPane
// and the card grids inside answer to the panel's width, not the window's.
export function TripWorkspace({
  rail,
  header,
  tabs,
  map,
  hueStyle,
  children,
}: {
  rail: ReactNode;
  header: ReactNode;
  tabs: ReactNode;
  map: ReactNode;
  // The trip's light, published as CSS variables for the one panel that still
  // reads it (the AI offer in "יעדים"). Goes on the panel, not the map.
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

        <div className="relative flex min-h-0 flex-1">
          <BottomSheet header={tabs} desktop="main" initial="full">
            <div className="@container mx-auto w-full max-w-[66rem] p-4" style={hueStyle}>
              <PageEnter className="pb-[env(safe-area-inset-bottom)]">
                {children}
              </PageEnter>
            </div>
          </BottomSheet>

          {/* Desktop: a folding pane beside the panel. Phone: the whole screen
              under the sheet. One node, so the map mounts once. */}
          <SidePane label="המפה" storageKey="trip-map-pane">
            {map}
          </SidePane>
        </div>
      </div>
    </div>
  );
}
