"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Layers, MessageCircle, Route, Sun } from "lucide-react";
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

// The Pencil design's five icons (v7).
const ICONS: Record<TripTabSegment, typeof Sun> = {
  today: Sun,
  days: Route,
  explore: Layers,
  ai: MessageCircle,
  more: FolderOpen,
};

// The terracotta dot the export puts on "גילוי": new here, until it has been
// opened once on this device. Per device on purpose — it is about what this
// person has seen, and it is nothing worth a column.
const SEEN_KEY = "mytrip:discover-seen";
const seenListeners = new Set<() => void>();
function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  return () => seenListeners.delete(listener);
}
function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode: the dot simply stays.
  }
  seenListeners.forEach((listener) => listener());
}

const WAITING = "ייפתח כשהטיול יתחיל";

// Every presentation of the trip's tabs is built from here, so a tab appears
// in all of them or in none. The waiting tab ("היום" before the trip) is kept,
// drawn muted and not pressable — an app that tells you what is coming rather
// than one that changes shape.
function useTripNavItems(tripId: string, live: boolean): NavItem[] {
  const pathname = usePathname();
  // `true` on the server, so the dot is never in the server HTML and then
  // pulled out on hydration for someone who has seen the tab.
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => true);
  const onDiscover = pathname.startsWith(tripTabHref(tripId, "discover"));
  useEffect(() => {
    if (onDiscover) markSeen();
  }, [onDiscover]);

  return tripTabsFor(live).map((tab) => {
    const Icon = ICONS[tab.segment];
    const href = tripTabHref(tripId, tab.segment);
    return {
      href,
      label: tab.label,
      icon:
        tab.segment === "explore" && !seen && !onDiscover ? (
          <span className="relative">
            <Icon className="h-[1.375rem] w-[1.375rem]" />
            <span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-cta ring-2 ring-surface" />
          </span>
        ) : (
          <Icon className="h-[1.375rem] w-[1.375rem]" />
        ),
      // "תכנון" is lit on both of its views.
      active:
        pathname === href ||
        pathname.startsWith(`${href}/`) ||
        (tab.segment === "explore" && onDiscover),
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
