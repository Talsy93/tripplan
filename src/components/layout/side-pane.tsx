"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/cn";

// Same-tab writes do not fire `storage`, so the toggle raises this instead.
const CHANGE_EVENT = "side-pane-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readOpen(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) !== "closed";
  } catch {
    return true;
  }
}

// A reference pane at the far edge of a workspace — the map, in the trip
// screens.
//
// Two presentations, one DOM node (so a Leaflet map inside mounts once):
//
//   lg+     a fixed-width sticky column that folds to a 44px strip. The fold
//           is remembered per browser — it is a preference about this screen,
//           not about the trip.
//   below   the whole screen under the header; the caller's bottom sheet
//           floats over it and the fold button is gone.
//
// The map used to take everything the panel left, and that was the wrong
// ratio: most of what a traveller does is in the panel, and the map is what
// they glance at. Domain-free: it does not know the content is a map.
export function SidePane({
  children,
  label,
  storageKey = "side-pane",
  className,
}: {
  children: ReactNode;
  // What the fold button says it hides or shows ("המפה").
  label: string;
  storageKey?: string;
  className?: string;
}) {
  // The fold lives in localStorage and is read through useSyncExternalStore
  // rather than copied into state in an effect: the server renders the pane
  // open, the first client paint agrees (getServerSnapshot), and the stored
  // value takes over without a second render setting state.
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(storageKey),
    () => true,
  );

  const toggle = () => {
    try {
      window.localStorage.setItem(storageKey, open ? "closed" : "open");
    } catch {
      // Storage can be unavailable (private mode); the pane then stays open.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <aside
      aria-label={label}
      className={cn(
        "relative h-[calc(100dvh-3.5rem)] min-w-0 flex-1 bg-surface-2",
        "lg:sticky lg:top-14 lg:flex-none lg:border-s lg:border-border lg:transition-[width] lg:duration-settle lg:ease-snap",
        open ? "lg:w-[22rem] xl:w-[26rem] 2xl:w-[30rem]" : "lg:w-11",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? `הסתירו את ${label}` : `הציגו את ${label}`}
        title={open ? `הסתירו את ${label}` : `הציגו את ${label}`}
        className={cn(
          "absolute top-3 z-[600] hidden h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-muted shadow-lift lg:flex",
          "transition-colors duration-press hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "end-3" : "start-1",
        )}
      >
        {/* In RTL the pane sits on the left, so folding moves it towards the
            left edge; the glyphs are mirrored to point that way. */}
        {open ? (
          <PanelRightClose className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        ) : (
          <PanelRightOpen className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        )}
      </button>

      <div className={cn("h-full w-full", !open && "lg:invisible")}>{children}</div>
    </aside>
  );
}
