"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Backpack,
  BookOpen,
  CalendarDays,
  Compass,
  Home,
  Map as MapIcon,
  Menu,
  MessageCircle,
  Sun,
} from "lucide-react";
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

// The icon rail while inside a trip. Sections, not tabs: the tabs live in the
// panel, and the rail gets between the home screen, this trip, and the trip's
// reference material.
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
  const inTrip = pathname.startsWith(`/trips/${tripId}`);
  const inMore = (segment: string) =>
    pathname.startsWith(`/trips/${tripId}/more/${segment}`);

  const items: NavItem[] = [
    {
      href: "/profile",
      label: "הטיולים שלי",
      icon: <Home className="h-5 w-5" />,
    },
    {
      href: tripTabHref(tripId, "today"),
      label: "הטיול",
      icon: <MapIcon className="h-5 w-5" />,
      active:
        inTrip && !inMore("guides") && !inMore("chat") && !inMore("gear"),
    },
    {
      href: `/trips/${tripId}/more/guides`,
      label: "מדריכי הערים",
      icon: <BookOpen className="h-5 w-5" />,
      active: inMore("guides"),
    },
    {
      href: `/trips/${tripId}/more/chat`,
      label: "הצ׳אט של הטיול",
      icon: <MessageCircle className="h-5 w-5" />,
      active: inMore("chat"),
    },
    {
      href: `/trips/${tripId}/more/gear`,
      label: "ציוד ואריזה",
      icon: <Backpack className="h-5 w-5" />,
      active: inMore("gear"),
    },
  ];

  return <IconRail items={items} initial={initial} footer={footer} />;
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
