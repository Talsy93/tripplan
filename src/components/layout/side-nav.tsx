import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NavItem } from "./bottom-nav";

// The desktop rail, on Booking's navy.
//
// Takes the same NavItem[] as BottomNav on purpose. trip-nav.tsx already had a
// comment explaining that building both presentations from one array is what
// stops them drifting; this is the third presentation and it follows the same
// contract, so a new tab appears in all three or in none.
export function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="flex h-full flex-col gap-1 overflow-y-auto bg-brand p-3"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-brand",
            item.active
              ? "bg-surface text-brand"
              : "text-brand-foreground/75 hover:bg-brand-foreground/10 hover:text-brand-foreground",
          )}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
