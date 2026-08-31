import Link from "next/link";
import { AuraField } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { NavItem } from "./bottom-nav";

// The desktop rail, carrying the trip's own light.
//
// It was --brand: the navy #003b95 left over from the Booking direction that the
// aura replaced. On a desktop screen that made three identities at once — brand
// navy in the rail, the trip's light in the band, and (until it was deleted) a
// photograph under that. The rail is the one piece of chrome that survives every
// tab switch, so it is the right place for the thing that says which trip you
// are in, and the wrong place for a colour that says nothing.
//
// Takes the same NavItem[] as BottomNav on purpose. trip-nav.tsx already had a
// comment explaining that building both presentations from one array is what
// stops them drifting; this is the third presentation and it follows the same
// contract, so a new tab appears in all three or in none.
//
// Domain-free: `hues` is three CSS colours. This component does not know what a
// trip is and must not learn.
export function SideNav({
  items,
  hues = [],
}: {
  items: NavItem[];
  hues?: string[];
}) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="relative isolate flex h-full flex-col gap-1 overflow-y-auto bg-aura-base p-3"
    >
      {/* animate={false}: the rail is on screen the entire time someone uses the
          app on a desktop, and drift in permanent peripheral vision is the one
          place this effect stops being atmosphere and becomes a distraction. */}
      <AuraField hues={hues} variant="rail" animate={false} blur={54} />
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            // relative, so the items sit above the field rather than under it.
            "relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base",
            item.active
              // White rather than a tint, for the reason the phone bar's pill is
              // ink: the selected item has to win against whatever colour the
              // light happens to be behind it, and only the extremes do that
              // reliably across eight palettes.
              ? "bg-white text-foreground shadow-lift"
              : "text-white/75 hover:bg-white/12 hover:text-white",
          )}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
