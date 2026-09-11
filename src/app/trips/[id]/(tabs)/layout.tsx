import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import {
  APP_TIME_ZONE,
  assignTripAuras,
  formatShortDate,
  getItinerary,
  getItineraryDayCount,
  getSelectedCitiesByTrip,
  getShareToken,
  getTrip,
  getTripRoute,
  listMembers,
  listTrips,
  phaseLabel,
  ShareButton,
  todayIn,
  tripHueStyle,
  tripPhase,
  TripRail,
  TripTabs,
  TripWorkspace,
  WorkspaceMap,
} from "@/features/trips";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  const name = trip?.name ?? "טיול";

  return {
    title: {
      default: `${name} · MyTrip`,
      template: `%s · ${name} · MyTrip`,
    },
  };
}

// The trip's frame (v5, "מפה חיה"): one workspace, the map as the canvas,
// the tabs in a panel beside it. Every tab under (tabs) renders into that
// panel; the map is loaded here, once, and stays put across tab switches.
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

  const [dayCount, members, shareToken, itinerary, citiesByTrip, trips, user] =
    await Promise.all([
      getItineraryDayCount(trip.id),
      listMembers(trip.id),
      getShareToken(trip.id),
      getItinerary(trip.id),
      getSelectedCitiesByTrip(),
      listTrips(),
      getCurrentUser(),
    ]);

  const route = await getTripRoute(trip.id, trip.name, itinerary);

  const phase = tripPhase(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
    dayCount,
  );

  // The city of the day the traveller is in, so its pin can be drawn live.
  const liveCity =
    phase.kind === "during"
      ? ([...(itinerary[phase.dayNumber - 1]?.items ?? [])]
          .reverse()
          .find((item) => item.city)?.city ?? null)
      : null;

  // Still published for the one lit panel in "יעדים" (AuraPanel). The aura
  // itself is gone from the chrome; this keeps that panel from falling back to
  // the neutral base until it is redesigned.
  const hues =
    assignTripAuras(
      trips.map((other) => ({
        id: other.id,
        cities: citiesByTrip.get(other.id) ?? [],
        createdAt: other.created_at,
      })),
    ).get(trip.id) ?? [];

  const dates =
    trip.start_date && trip.end_date
      ? `${formatShortDate(trip.start_date)}–${formatShortDate(trip.end_date)}`
      : trip.start_date
        ? `מ-${formatShortDate(trip.start_date)}`
        : null;

  return (
    <TripWorkspace
      rail={<TripRail tripId={trip.id} initial={user?.email?.[0]} />}
      header={
        <AppHeader
          wide
          title={trip.name}
          back={
            <Link
              href="/profile"
              aria-label="הטיולים שלי"
              className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-foreground lg:hidden"
            >
              {/* In RTL "back" points right, towards where the list came from. */}
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          }
          badge={
            <span className="flex min-w-0 shrink-0 items-center gap-1.5">
              {dates && (
                <Badge tone="neutral" className="hidden tabular-nums sm:inline-flex">
                  {dates}
                </Badge>
              )}
              <Badge tone={phase.kind === "during" ? "callout" : "action"}>
                {phaseLabel(phase)}
              </Badge>
            </span>
          }
          trailing={
            <ShareButton
              tripId={trip.id}
              memberCount={members.filter((member) => !member.is_owner).length}
              isShared={shareToken !== null}
            />
          }
        />
      }
      tabs={<TripTabs tripId={trip.id} />}
      map={
        <WorkspaceMap
          stops={route.stops}
          places={route.places}
          liveCity={liveCity}
        />
      }
      hueStyle={tripHueStyle(hues)}
    >
      {children}
    </TripWorkspace>
  );
}
