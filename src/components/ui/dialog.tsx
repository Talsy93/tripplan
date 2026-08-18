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
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-modal border border-border bg-surface p-0 text-foreground shadow-modal",
        "backdrop:bg-scrim",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-border p-4">
        <h2 className="min-w-0 flex-1 text-title font-bold">{title}</h2>
        <IconButton label="סגירה" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-col gap-4 p-4">{children}</div>

      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
