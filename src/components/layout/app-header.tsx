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
// The wordmark is no longer here by default. In the desktop design the bar
// carries the trip — its name, its phase, sharing, the avatar — and MYTRIP sits
// at the top of the rail, which is the one piece of chrome that survives a tab
// switch. `brand` is for the screens that have no rail yet and would otherwise
// lose the app's name entirely.
//
// h-14 is load-bearing: several screens offset sticky elements by exactly this.
export function AppHeader({
  title,
  badge,
  back,
  trailing,
  brand = false,
  className,
}: {
  title?: ReactNode;
  // Sits directly after the title, at its start edge — a state, not an action.
  // Its own slot rather than part of `trailing` because in the design it reads
  // as a property of the name it follows, not as one of the controls at the
  // far end of the bar.
  badge?: ReactNode;
  // A back link, when the screen is a level down.
  back?: ReactNode;
  trailing?: ReactNode;
  // The wordmark, for a screen with no rail to put it in.
  brand?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 border-b border-border bg-surface/95 backdrop-blur",
        className,
      )}
    >
      {/* Capped and centred on the same box as the content underneath, so the
          bar's contents line up with the first card rather than drifting to
          the far edge of a 1900px window while the content stays centred. */}
      <div className="mx-auto flex h-full w-full max-w-content items-center gap-3 px-4 md:px-6 lg:px-8">
        {brand && (
          <Link
            href="/profile"
            className="flex shrink-0 items-center gap-1.5 font-bold text-brand"
          >
            <Plane className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">MyTrip</span>
          </Link>
        )}

        {back}

        {/* At the start edge, not centred. Centring was what the wordmark on
            the other side of it was balancing; with the wordmark gone a
            floating middle title has nothing to be between. */}
        {title && (
          <span className="min-w-0 truncate text-base font-black">{title}</span>
        )}

        {badge}

        {trailing && (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}
