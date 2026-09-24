"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

// A modal on top of the native <dialog>.
//
// Native rather than a portal + focus trap: the platform already gives us the
// top layer, the backdrop, focus containment and Escape, and every one of those
// is a thing a hand-rolled modal gets subtly wrong. place-details.tsx was
// already doing this correctly — the point of extracting it is that the next
// modal does not have to rediscover showModal(), the `cancel` event, and the
// fact that a click on the backdrop lands on the dialog element itself.
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `cancel` is Escape. Without preventDefault the browser closes the
      // dialog itself and React's `open` prop is left believing it is still up.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the backdrop is reported as a click on the dialog element,
      // because the backdrop is a pseudo-element and has no own target. Any
      // click that did not land on a descendant is therefore a backdrop click.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-modal bg-surface p-0 text-foreground shadow-modal",
        // Phones: a sheet from the bottom edge (Pencil, v7) — the thumb is
        // already there, and the page behind stays in view above it.
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-[28px]",
        "backdrop:bg-scrim backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div aria-hidden="true" className="flex justify-center pt-2.5 sm:hidden">
        <span className="h-[5px] w-10 rounded-full bg-border" />
      </div>
      <div className="flex items-center gap-3 px-5 pt-3 pb-1 sm:pt-5">
        <h2 className="min-w-0 flex-1 text-[22px] leading-tight font-bold">{title}</h2>
        <IconButton label="סגירה" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-3 pb-6">{children}</div>

      {footer && (
        <div className="flex items-center justify-end gap-2 px-5 pb-6">
          {footer}
        </div>
      )}
    </dialog>
  );
}
