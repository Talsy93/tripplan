import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "./bottom-nav";

// The desktop rail of the "מפה חיה" direction: 64px, icons only, white.
//
// It replaces the 248px SideNav that carried the trip's aura. In a workspace
// whose canvas is a map, a wide coloured rail was the loudest thing on screen
// and said the least; the trip's name now lives in the header, and the rail
// is left with the one job it always had — getting between sections.
//
// Domain-free, like BottomNav: it is handed items and told which one is
// current. Labels are kept for screen readers and as tooltips.
export function IconRail({
  items,
  initial,
  footer,
}: {
  items: NavItem[];
  // The signed-in person's first letter, shown at the bottom.
  initial?: string;
  // Between the items and the avatar — a theme toggle, a settings link.
  footer?: ReactNode;
}) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="flex h-full w-rail flex-col items-center gap-1.5 border-e border-border bg-surface px-2.5 pb-4 pt-3"
    >
      <Link
        href="/profile"
        aria-label="MyTrip — הטיולים שלי"
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-control bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <MapPin className="h-5 w-5" aria-hidden="true" />
      </Link>

      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-control transition-colors duration-press ease-snap",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            item.active
              ? "bg-primary-tint text-primary-ink"
              : "text-muted hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span className="sr-only">{item.label}</span>
        </Link>
      ))}

      <div className="mt-auto flex flex-col items-center gap-1.5">
        {footer}
        {initial && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-sm font-bold uppercase text-primary-ink"
          >
            {initial}
          </span>
        )}
      </div>
    </nav>
  );
}
