"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Menu, Sun } from "lucide-react";
import {
  BottomNav,
  IconRail,
  SideNav,
  type NavItem,
} from "@/components/layout";
import { cn } from "@/lib/cn";
import {
  TRIP_TABS,
  tripTabHref,
  type TripTabSegment,
} from "../domain/trip-tabs";
import { railShortcuts } from "../domain/rail-shortcuts";
import { RAIL_ICONS, RailEditorButton, useRailShortcuts } from "./rail-editor";

const ICONS: Record<TripTabSegment, typeof Sun> = {
  today: Sun,
  days: CalendarDays,
  explore: Compass,
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
      active: pathname === href || pathname.startsWith(`${href}/`),
    };
  });
}

// The panel's tab row (v5). Segmented, links rather than buttons: each tab is
// a route, so the browser's back button and a shared URL both keep working.
// Built from TRIP_TABS like every other presentation, so a tab appears in all
// of them or in none.
//
// `prefetch` is on deliberately. Next's default for a dynamic route fetches
// only as far as its loading.tsx, so clicking a tab bought a skeleton
// immediately and then waited on a round trip to the database for the content —
// the wait that made switching tabs feel slow. These four links are the app's
// most-used navigation and they are on screen the whole time a trip is open, so
// the three you are not on are worth rendering ahead of the click; they are then
// held by staleTimes.static (see next.config.ts) for three minutes.
//
// The cost is three background renders when a trip opens. If that ever becomes
// the wrong trade — many more tabs, or a tab that is expensive to render —
// this prop is the one line to remove.
export function TripTabs({ tripId }: { tripId: string }) {
  const items = useTripNavItems(tripId);

  return (
    <nav
      aria-label="חלקי הטיול"
      className="flex gap-1 rounded-control border border-border bg-surface-2 p-1"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-sm font-semibold",
            "transition-[background-color,color,box-shadow] duration-press ease-snap",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.active
              ? "bg-surface text-foreground shadow-card"
              : "text-muted hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="hidden sm:inline lg:hidden xl:inline">
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// The icon rail while inside a trip: the traveller's own shortcuts.
//
// Which parts of the trip appear here, and in what order, comes from the
// catalogue in domain/rail-shortcuts.ts and the choice stored in this browser
// (rail-editor.tsx). The button at the foot of the rail edits it. No "home"
// item: the wordmark at the top is the way home.
export function TripRail({
  tripId,
  initial,
  footer,
}: {
  tripId: string;
  initial?: string;
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const keys = useRailShortcuts();

  const items: NavItem[] = railShortcuts(keys).map((shortcut) => {
    const Icon = RAIL_ICONS[shortcut.key];
    const href = `/trips/${tripId}/${shortcut.path}`;
    return {
      href,
      label: shortcut.label,
      icon: <Icon className="h-5 w-5" />,
      active: pathname === href || pathname.startsWith(`${href}/`),
    };
  });

  return (
    <IconRail
      items={items}
      initial={initial}
      footer={
        <>
          <RailEditorButton />
          {footer}
        </>
      }
    />
  );
}

// --- the pre-v5 presentations, kept for the preview harness -----------------

export function TripNav({ tripId }: { tripId: string }) {
  const items = useTripNavItems(tripId);

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
  hues = [],
  initial,
  header,
  footer,
}: {
  tripId: string;
  hues?: string[];
  initial?: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SideNav
      items={useTripNavItems(tripId)}
      hues={hues}
      initial={initial}
      header={header}
      footer={footer}
    />
  );
}
