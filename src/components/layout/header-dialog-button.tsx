"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui";

// A header control that opens a small dialog — the bell and the avatar of the
// home bar. The trigger is drawn by the caller; the dialog holds whatever the
// page slots in (a push toggle, the account and sign-out).
export function HeaderDialogButton({
  label,
  title,
  trigger,
  className,
  children,
}: {
  label: string;
  title: string;
  trigger: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {trigger}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Dialog>
    </>
  );
}
