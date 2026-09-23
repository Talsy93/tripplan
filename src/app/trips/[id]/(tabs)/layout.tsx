import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
import { AppHeader, HeaderPill } from "@/components/layout";
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
  listMembers,
  listTrips,
  phaseLabel,
  ShareButton,
  todayIn,
  tripHueStyle,
  tripPhase,
  TripNameButton,
  TripRail,
  TripTabs,
  TripWorkspace,
  tripDayCount,
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

// The trip's frame (v6, the Stitch design): a header with the trip and a
// location pill, a column of cards, and the four tabs — pinned to the bottom
// on a phone, a rail on a desktop. The map is no longer the canvas; it is a
// card on "מסלול" and a full screen of its own at /map.
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

  const totalDays = tripDayCount(trip.start_date, trip.end_date) ?? dayCount;

  // Stitch's pill: "רומא, יום 3 מ-7" while the trip is on; before and after,
  // the phase and the dates.
  const pill =
    phase.kind === "during"
      ? [liveCity, `יום ${phase.dayNumber} מ-${totalDays}`]
          .filter(Boolean)
          .join(", ")
      : [phaseLabel(phase), dates].filter(Boolean).join(" · ");

  const live = phase.kind === "during";

  return (
    <TripWorkspace
      rail={<TripRail tripId={trip.id} live={live} initial={user?.email?.[0]} />}
      header={
        <AppHeader
          wide
          title={<TripNameButton tripId={trip.id} name={trip.name} />}
          back={
            <Link
              href="/profile"
              aria-label="הטיולים שלי"
              className="-ms-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-sunken hover:text-foreground lg:hidden"
            >
              {/* In RTL "back" points right, towards where the list came from. */}
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          }
          pill={
            <HeaderPill icon={<MapPin />} className={live ? "text-foreground" : undefined}>
              {pill}
            </HeaderPill>
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
      tabs={
        <TripTabs
          tripId={trip.id}
          // "היום" only exists while the trip is on. See TRIP_TABS.
          live={live}
        />
      }
      hueStyle={tripHueStyle(hues)}
    >
      {children}
    </TripWorkspace>
  );
}
