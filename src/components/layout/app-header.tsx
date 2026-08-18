import Link from "next/link";
import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import { cn } from "@/lib/cn";

// The app's top bar, extracted in phase D.
//
// It used to live inline inside the trip tabs layout with its own hardcoded
// max-w-5xl, which duplicated AppShell's width map and meant /profile and the
// city page had no header at all — there was no global chrome anywhere.
//
// h-14 is load-bearing: AppShell offsets the sticky sidebar by exactly this.
export function AppHeader({
  title,
  back,
  trailing,
  wide = true,
  className,
}: {
  title?: ReactNode;
  // A back link, when the screen is a level down.
  back?: ReactNode;
  trailing?: ReactNode;
  // Matches the frame the content below is using, so the header's contents line
  // up with the first card rather than floating off-centre.
  wide?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 border-b border-border bg-surface/95 backdrop-blur",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-full w-full items-center gap-3 px-4 md:px-6 lg:px-8",
          wide ? "max-w-shell" : "max-w-3xl",
        )}
      >
        <Link
          href="/profile"
          className="flex shrink-0 items-center gap-1.5 font-bold text-brand"
        >
          <Plane className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">TripPlan</span>
        </Link>

        {back}

        {title && (
          <span className="mx-auto min-w-0 truncate text-sm font-semibold">
            {title}
          </span>
        )}

        {trailing && (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}
