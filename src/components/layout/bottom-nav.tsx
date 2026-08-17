import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

// The phone navigation bar. Domain-free and presentational: it is handed items
// and told which one is current, so the same bar can serve any section.
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch justify-around px-1 pt-1.5">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "mx-auto flex max-w-20 flex-col items-center gap-1 rounded-control py-1.5 text-[11px] transition-colors",
                item.active
                  ? "font-bold text-primary"
                  : "text-muted hover:text-foreground",
              )}
            >
              {/* A filled pill behind the icon, not just a colour change on
                  text+icon: five glyphs of near-equal weight sit side by side,
                  and colour alone is the kind of signal that washes out in
                  direct sun — exactly the lighting a travel app gets used in.
                  The pill is the same "filled = selected" language the desktop
                  strip and SegmentedControl already use, just moved onto the
                  icon since the mobile bar has no room for a full row fill. */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-11 items-center justify-center rounded-full transition-colors",
                  item.active && "bg-primary-tint",
                )}
              >
                {item.icon}
              </span>
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
