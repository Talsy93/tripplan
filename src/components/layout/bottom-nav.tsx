import Link from "next/link";
import type { ReactNode } from "react";
import { glassClasses } from "@/components/ui";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

// The phone navigation bar. Domain-free and presentational: it is handed items
// and told which one is current, so the same bar can serve any section.
//
// It floats, and that is the point rather than a flourish. It used to be an
// edge-to-edge strip with a top border and an opaque fill — chrome that framed
// the content and cut the screen off at a hard line. Now it is a rounded pane of
// glass inset from all three edges, and the list scrolls under it: the content
// is the surface, and the controls sit above it. That is the one structural idea
// the two 2026 mobile design languages actually agree on.
//
// Two consequences worth knowing before changing it:
//
//   * AppShell's bottom padding has to clear it, and that padding is now 6rem
//     rather than 5rem — the bar's own inset counts.
//   * the nav element itself is pointer-events-none and only the bar re-enables
//     them, so the 12px of page either side of a floating bar is not a dead
//     strip that swallows taps meant for the content behind it.
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      <ul
        className={cn(
          glassClasses("light"),
          "pointer-events-auto mx-auto flex max-w-md items-stretch justify-around rounded-tile p-1.5",
        )}
      >
        {items.map((item) => (
          <li key={item.href} className="min-w-0 flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "mx-auto flex max-w-20 flex-col items-center gap-1 rounded-control py-1.5 text-caption",
                "transition-[color,transform] duration-press ease-snap active:scale-[0.94]",
                // Phase D: this was the one interactive surface in the layout
                // layer with no focus ring at all.
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.active
                  ? "font-bold text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {/* A filled pill behind the icon, not just a colour change on
                  text+icon: five glyphs of near-equal weight sit side by side,
                  and colour alone is the kind of signal that washes out in
                  direct sun — exactly the lighting a travel app gets used in.

                  Ink rather than the blue tint it used to be. On glass, a pale
                  tint has almost nothing to sit against and the selected tab
                  stopped being obvious; ink is the highest contrast available
                  and it also says "state" rather than "press me", which the
                  blue — the app's action colour everywhere else — did not. */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-11 items-center justify-center rounded-full",
                  "transition-[background-color,color] duration-settle ease-snap",
                  item.active && "bg-foreground text-surface",
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 max-w-full truncate px-0.5">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
