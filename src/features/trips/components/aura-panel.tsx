import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The one highlighted panel on the discovery tab — the AI's offer.
//
// It used to carry the trip's aura: a dark field lit with the trip's three
// hues. v5 ("מפה חיה") has no dark surfaces and no per-trip colour, so the
// highlight is the action tint with the action colour's border: still the one
// thing on the screen that is not a white card on grey, which is the whole
// point (law 03 — one lit element), and readable in daylight.
//
// The name stays for now so its call sites and preview scenes keep compiling;
// slice 4 renames it with the rest of the aura clean-up.
export function AuraPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-primary/30 bg-primary-tint p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}
