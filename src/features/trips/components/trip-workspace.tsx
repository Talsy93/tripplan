import type { CSSProperties, ReactNode } from "react";
import { BottomSheet, PageEnter } from "@/components/layout";

// The frame of a trip in the "מפה חיה" direction: one workspace, the map as
// its canvas, and a panel beside it that holds whatever the current tab
// renders.
//
//   desktop (lg+):  [ rail 64 ][ panel 440 ][ map ······ ]   (RTL: rail on the right)
//   phone:          map full-screen, the panel is a bottom sheet over it
//
// The panel is one DOM node in both presentations — see BottomSheet — so a
// tab's page mounts once. The map is sticky under the header on desktop and
// simply the screen on a phone; the sheet is fixed, so it never affects flow.
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
          <BottomSheet header={tabs} desktop="column">
            <div className="p-3 lg:p-4" style={hueStyle}>
              <PageEnter className="pb-[env(safe-area-inset-bottom)]">
                {children}
              </PageEnter>
            </div>
          </BottomSheet>

          <div className="relative h-[calc(100dvh-3.5rem)] min-w-0 flex-1 lg:sticky lg:top-14">
            {map}
          </div>
        </div>
      </div>
    </div>
  );
}
