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
      className="flex h-full w-rail flex-col items-center gap-2 bg-surface px-2 pb-4 pt-4 shadow-[4px_0_20px_rgba(2,132,199,0.06)]"
    >
      {/* The wordmark is also the way home — the only control for it. It used
          to sit above a "הטיולים שלי" item that went to the same place, which
          read as two tabs for one screen. */}
      <Link
        href="/profile"
        aria-label="MyTrip — הטיולים שלי"
        title="הטיולים שלי"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--hero-gradient)] text-primary-foreground shadow-lift transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <MapPin className="h-5 w-5" aria-hidden="true" />
      </Link>

      {items.map((item) =>
        item.waiting ? (
          <span
            key={item.href}
            title={item.waiting}
            className="flex w-full flex-col items-center gap-1 py-1.5 text-[0.6875rem] font-medium leading-4 text-border-strong"
          >
            <span aria-hidden="true" className="flex h-8 w-14 items-center justify-center">
              {item.icon}
            </span>
            <span className="max-w-full truncate px-0.5">{item.label}</span>
            <span className="sr-only">— {item.waiting}</span>
          </span>
        ) : (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "group/rail flex w-full flex-col items-center gap-1 rounded-control py-1.5 text-[0.6875rem] leading-4 transition-colors duration-press ease-snap",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.active
              ? "font-semibold text-brand-2"
              : "font-medium text-muted hover:text-foreground",
          )}
        >
          {/* Stitch's nav pill: the icon sits in a rounded capsule that fills
              when the item is the one you are on. */}
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-settle ease-snap",
              item.active
                ? "bg-primary-tint text-brand-2 shadow-soft"
                : "group-hover/rail:bg-surface-2",
            )}
          >
            {item.icon}
          </span>
          <span className="max-w-full truncate px-0.5">{item.label}</span>
        </Link>
        ),
      )}

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
