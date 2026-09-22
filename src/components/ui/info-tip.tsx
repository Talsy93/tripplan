"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

// Help that is there when it is wanted and gone when it is not.
//
// The alternative it replaces is a paragraph under the field, and the trouble
// with that paragraph is that it is read once. After that it is permanent
// furniture in a form that is already long — the connection editor was three
// lines of prose above the one control it described, on every booking, for the
// overwhelming majority of bookings that are direct.
//
// **Click, not hover.** A tooltip that only opens on hover does not exist on a
// phone, which is the same mistake the delete button made (see swipe-action).
// So this is a disclosure: press to open, press again, press anywhere else, or
// Escape to close.
//
// The panel stays in the DOM and is hidden with `hidden` rather than
// unmounted, so `aria-describedby` on the button keeps pointing at something —
// a screen reader reads a referenced hidden element, which means the help is
// available without the panel ever being opened.
//
// Domain-free: it is handed a label and some content.
export function InfoTip({
  label,
  children,
  className,
}: {
  // The button's accessible name — "what does this mean", in the words of the
  // thing being explained.
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    // `pointerdown` rather than `click`: a press that starts outside should
    // close the panel before whatever it landed on reacts, so dismissing does
    // not also press the control underneath.
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-describedby={panelId}
        aria-label={label}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors",
          "hover:bg-surface-2 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-surface-2 text-foreground",
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>

      <span
        id={panelId}
        hidden={!open}
        // `start-0` and not `end-0`: the panel hangs from the button's leading
        // edge and opens away from it, which in this RTL app means it grows
        // leftwards into the form rather than off the side of the screen.
        //
        // The width is capped against the viewport as well as set, because
        // these sit inside cards that are themselves narrower than the screen
        // on a phone.
        className={cn(
          "absolute top-full z-30 mt-1.5 start-0",
          "w-[min(20rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-3",
          "text-start text-caption font-normal leading-relaxed text-foreground shadow-modal",
        )}
      >
        {children}
      </span>
    </span>
  );
}
