"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Map, Menu, Sun } from "lucide-react";
import { BottomNav, type NavItem } from "@/components/layout";
import { cn } from "@/lib/cn";
import {
  TRIP_TABS,
  tripTabHref,
  type TripTabSegment,
} from "../domain/trip-tabs";

// Keyed by segment, so adding a tab without giving it an icon fails to compile
// rather than rendering a gap.
const ICONS: Record<TripTabSegment, typeof Sun> = {
  today: Sun,
  days: CalendarDays,
  explore: Compass,
  map: Map,
  more: Menu,
};

// One list, two presentations: a fixed bar on phones and a pill row from md up.
// Building both from the same array is what stops them drifting — the six-tab
// version they replace existed in exactly one place for the same reason.
export function TripNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  const items: NavItem[] = TRIP_TABS.map((tab) => {
    const Icon = ICONS[tab.segment];
    const href = tripTabHref(tripId, tab.segment);
    return {
      href,
      label: tab.label,
      icon: <Icon className="h-5 w-5" />,
      // Matched on a segment boundary, not by bare prefix: a sub-screen such
      // as /more/phrases must keep "עוד" lit, while /days must not light up
      // for a hypothetical /d.
      active: pathname === href || pathname.startsWith(`${href}/`),
    };
  });

  return (
    <>
      <div className="hidden md:flex md:gap-1 md:self-start md:rounded-full md:border md:border-border md:bg-surface-2 md:p-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              item.active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted hover:text-foreground",
            )}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <BottomNav items={items} />
    </>
  );
}
