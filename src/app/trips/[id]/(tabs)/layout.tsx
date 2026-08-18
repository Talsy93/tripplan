import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppHeader, AppShell } from "@/components/layout";
import { Badge } from "@/components/ui";
import {
  APP_TIME_ZONE,
  getItineraryDayCount,
  getTrip,
  phaseLabel,
  todayIn,
  TripNav,
  TripSideNav,
  tripPhase,
} from "@/features/trips";

// Shared chrome for the five trip tabs.
//
// This lives in a (tabs) route group rather than at [id]/layout.tsx so that
// city/[city] — which has its own back link and no tab bar — does not inherit
// it. App Router does not re-render a layout when navigating between its own
// children, so the header and nav survive a tab switch untouched.
export default async function TripTabsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  // Derived, not stored — see ARCHITECTURE.md #6. The day count only changes
  // the answer for a trip with a start date and no end date.
  const dayCount = await getItineraryDayCount(trip.id);
  const phase = tripPhase(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
    dayCount,
  );

  return (
    <AppShell
      header={
        <AppHeader
          title={trip.name}
          back={
            <Link
              href="/profile"
              className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              {/* In RTL "back" points left, and the glyph is chosen by
                  meaning rather than by mirroring the LTR arrow. */}
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">הטיולים שלי</span>
            </Link>
          }
          trailing={
            <Badge tone={phase.kind === "during" ? "success" : "neutral"}>
              {phaseLabel(phase)}
            </Badge>
          }
        />
      }
      sidebar={<TripSideNav tripId={trip.id} />}
      nav={<TripNav tripId={trip.id} />}
    >
      {children}
    </AppShell>
  );
}
