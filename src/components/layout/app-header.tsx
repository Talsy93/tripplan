import Link from "next/link";
import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import { cn } from "@/lib/cn";

// The top bar, in the Stitch design (v6): frosted canvas colour, no rule
// underneath — a hairline shadow does it — and three zones.
//
//   start   the back link, then a small blue "MYTRIP" eyebrow over the title
//   middle  a location pill (where you are, which day)
//   end     round icon actions
//
// `pill` is the middle zone. It is hidden below sm when the bar also carries
// a long title, because at 360px the three zones cannot all fit on one row.
export function AppHeader({
  title,
  badge,
  pill,
  back,
  trailing,
  brand = false,
  eyebrow,
  wide = false,
  className,
}: {
  title?: ReactNode;
  // Kept for callers that put a status next to the title.
  badge?: ReactNode;
  pill?: ReactNode;
  back?: ReactNode;
  trailing?: ReactNode;
  // The wordmark and the way home, for screens outside a trip.
  brand?: boolean;
  // The small line above the title. Defaults to the wordmark when there is a
  // title, which is what every Stitch screen carries.
  eyebrow?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background/85 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 w-full items-center gap-3 px-4",
          wide ? "lg:px-6" : "max-w-content md:px-6 lg:px-8",
        )}
      >
        {brand && (
          <Link
            href="/profile"
            className="flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--hero-gradient)] text-primary-foreground shadow-soft">
              <Plane className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            {!title && (
              <span className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-foreground">MyTrip</span>
                <span className="text-[0.625rem] font-semibold uppercase tracking-latin text-primary">
                  Travel Companion
                </span>
              </span>
            )}
          </Link>
        )}

        {back}

        {title && (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[0.625rem] font-semibold uppercase tracking-latin text-primary">
              {eyebrow ?? "MyTrip"}
            </span>
            <span className="min-w-0 truncate text-lg font-semibold text-foreground">
              {title}
            </span>
          </span>
        )}

        {badge}

        {pill && (
          <div className="mx-auto hidden min-w-0 sm:flex">{pill}</div>
        )}

        {trailing && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1",
              pill ? "ms-auto sm:ms-0" : "ms-auto",
            )}
          >
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}

// The middle of the bar: a lavender capsule with a pin, "רומא, יום 3 מ-7".
export function HeaderPill({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-caption font-medium text-muted shadow-soft",
        className,
      )}
    >
      {icon && (
        <span className="shrink-0 text-primary [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
