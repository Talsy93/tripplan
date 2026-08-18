"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Map as MapIcon, Menu, Sun } from "lucide-react";
import { BottomNav, SideNav, type NavItem } from "@/components/layout";
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
  map: MapIcon,
  more: Menu,
};

function useTripNavItems(tripId: string): NavItem[] {
  const pathname = usePathname();

  return TRIP_TABS.map((tab) => {
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
}

// One list, three presentations: a fixed bar on phones, a pill row on tablets,
// and a rail on desktop. Building all three from the same array is what stops
// them drifting — the six-tab version they replace existed in exactly one place
// for the same reason.
//
// This component covers the first two. The rail is rendered by TripSideNav into
// AppShell's `sidebar` slot, because it has to sit outside the content column.
export function TripNav({ tripId }: { tripId: string }) {
  const items = useTripNavItems(tripId);

  return (
    <>
      <div className="hidden gap-1 self-start rounded-full border border-border bg-surface-2 p-1 md:flex lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

export function TripSideNav({ tripId }: { tripId: string }) {
  return <SideNav items={useTripNavItems(tripId)} />;
}
