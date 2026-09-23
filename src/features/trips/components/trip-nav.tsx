"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, FolderOpen, Sparkles, Sun } from "lucide-react";
import {
  BottomNav,
  IconRail,
  SideNav,
  type NavItem,
} from "@/components/layout";
import { cn } from "@/lib/cn";
import {
  tripTabsFor,
  tripTabHref,
  type TripTabSegment,
} from "../domain/trip-tabs";

const ICONS: Record<TripTabSegment, typeof Sun> = {
  today: Compass,
  days: CalendarDays,
  explore: Sparkles,
  more: FolderOpen,
};

const WAITING = "ייפתח כשהטיול יתחיל";

// Every presentation of the trip's tabs is built from here, so a tab appears
// in all of them or in none. The waiting tab ("היום" before the trip) is kept,
// drawn muted and not pressable — an app that tells you what is coming rather
// than one that changes shape.
function useTripNavItems(tripId: string, live: boolean): NavItem[] {
  const pathname = usePathname();

  return tripTabsFor(live).map((tab) => {
    const Icon = ICONS[tab.segment];
    const href = tripTabHref(tripId, tab.segment);
    return {
      href,
      label: tab.label,
      icon: <Icon className="h-[1.375rem] w-[1.375rem]" />,
      active: pathname === href || pathname.startsWith(`${href}/`),
      waiting: tab.waiting ? WAITING : undefined,
    };
  });
}

// v6 (Stitch): the phone's tab bar — pinned to the bottom edge, four tabs. The
// desktop gets the same four as a rail (TripRail below), so the bar goes at lg.
//
// Links rather than buttons: each tab is a route, so the back button and a
// shared URL keep working. `prefetch` is on in BottomNav — these are the most
// used links in the app and they are on screen the whole time.
export function TripTabs({
  tripId,
  live = false,
}: {
  tripId: string;
  live?: boolean;
}) {
  return <BottomNav items={useTripNavItems(tripId, live)} className="lg:hidden md:block" />;
}

// The desktop rail: the wordmark (the way home), the four tabs, the initial.
export function TripRail({
  tripId,
  live = false,
  initial,
  footer,
}: {
  tripId: string;
  live?: boolean;
  initial?: string;
  footer?: ReactNode;
}) {
  return (
    <IconRail
      items={useTripNavItems(tripId, live)}
      initial={initial}
      footer={footer}
    />
  );
}

// --- the pre-v5 presentations, kept for the preview harness -----------------

export function TripNav({
  tripId,
  live = false,
}: {
  tripId: string;
  live?: boolean;
}) {
  const items = useTripNavItems(tripId, live);

  return (
    <>
      <div className="mt-4 hidden gap-1 self-start rounded-full border border-border bg-surface-2 p-1 md:flex lg:hidden">
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

export function TripSideNav({
  tripId,
  live = false,
  hues = [],
  initial,
  header,
  footer,
}: {
  tripId: string;
  live?: boolean;
  hues?: string[];
  initial?: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SideNav
      items={useTripNavItems(tripId, live)}
      hues={hues}
      initial={initial}
      header={header}
      footer={footer}
    />
  );
}
