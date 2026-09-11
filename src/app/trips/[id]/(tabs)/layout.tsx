import { Suspense } from "react";
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

// The map's own data, resolved after the workspace is already on screen.
//
// getTripRoute is the expensive read in this route by a wide margin: half a
// dozen queries that have to run in order, and — for a city nobody has looked
// up yet — Nominatim lookups paced at about one a second. Awaiting it in the
// layout meant the header, the tabs and the whole panel waited on the pane
// beside them. Behind a boundary the map is the only thing that waits, and it
// waits where a map already looks like it is loading.
async function RouteMap({
  tripId,
  tripName,
  itinerary,
  liveCity,
}: {
  tripId: string;
  tripName: string;
  itinerary: Awaited<ReturnType<typeof getItinerary>>;
  liveCity: string | null;
}) {
  const route = await getTripRoute(tripId, tripName, itinerary);

  return (
    <WorkspaceMap
      stops={route.stops}
      places={route.places}
      liveCity={liveCity}
    />
  );
}

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

  // The trip goes out with the rest rather than ahead of them: nothing in this
  // wave needs it first (they all key off the same id), and awaiting it alone
  // made opening a trip two round trips to Frankfurt instead of one.
  const [
    trip,
    dayCount,
    members,
    shareToken,
    itinerary,
    citiesByTrip,
    trips,
    user,
  ] = await Promise.all([
    getTrip(id),
    getItineraryDayCount(id),
    listMembers(id),
    getShareToken(id),
    getItinerary(id),
    getSelectedCitiesByTrip(),
    listTrips(),
    getCurrentUser(),
  ]);

  if (!trip) {
    notFound();
  }

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
        <Suspense
          fallback={<div className="h-full w-full animate-pulse bg-surface-2" />}
        >
          <RouteMap
            tripId={trip.id}
            tripName={trip.name}
            itinerary={itinerary}
            liveCity={liveCity}
          />
        </Suspense>
      }
      hueStyle={tripHueStyle(hues)}
    >
      {children}
    </TripWorkspace>
  );
}
