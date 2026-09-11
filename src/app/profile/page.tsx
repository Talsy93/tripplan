import { Home } from "lucide-react";
import { AppHeader, BottomSheet, IconRail } from "@/components/layout";
import type { NavItem } from "@/components/layout";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  APP_TIME_ZONE,
  daysUntil,
  getCachedStopsByTrip,
  getItinerary,
  getItineraryDayCountByTrip,
  getSelectedDestinations,
  HomeMap,
  HomePanel,
  itineraryStops,
  listBookings,
  listTrips,
  orderTripsByProximity,
  pickFeaturedTrip,
  todayIn,
  tripOpenItems,
} from "@/features/trips";
import type { MappedTrip, OpenItem } from "@/features/trips";

export const metadata = { title: "הטיולים שלי · MyTrip" };

// The home screen of the "מפה חיה" direction: every trip on one map, and a
// panel floating over it (a bottom sheet on a phone) with the next trip and
// its next step first, then the rest as numbered rows.
export default async function ProfilePage() {
  const [user, trips, dayCounts, pointsByTrip] = await Promise.all([
    getCurrentUser(),
    listTrips(),
    getItineraryDayCountByTrip(),
    getCachedStopsByTrip(),
  ]);

  const today = todayIn(APP_TIME_ZONE, new Date());
  const ordered = orderTripsByProximity(trips, today, dayCounts);
  const featured = pickFeaturedTrip(ordered);

  let featuredCities: string[] = [];
  let featuredDayCount = 0;
  let featuredOpen: OpenItem[] = [];

  if (featured) {
    const [itinerary, bookings] = await Promise.all([
      getItinerary(featured.trip.id),
      listBookings(featured.trip.id),
    ]);
    featuredDayCount = itinerary.length;
    featuredCities = itineraryStops(itinerary).map((stop) => stop.city);
    if (featuredCities.length === 0) {
      const selected = await getSelectedDestinations(featured.trip.id);
      featuredCities = [
        ...new Set(selected.map((item) => item.city).filter(Boolean)),
      ];
    }
    featuredOpen = tripOpenItems({
      startDate: featured.trip.start_date,
      daysUntilStart: featured.trip.start_date
        ? daysUntil(featured.trip.start_date)
        : null,
      dayCount: featuredDayCount,
      cities: featuredCities,
      itinerary,
      bookings,
    });
  }

  // One dot colour per standing, not per trip: the featured trip is the blue
  // one, everything else is quiet. The number in the panel does the naming.
  const mapped: MappedTrip[] = ordered.flatMap(({ trip, phase }) => {
    const points = pointsByTrip.get(trip.id) ?? [];
    if (points.length === 0) return [];
    const isFeatured = trip.id === featured?.trip.id;
    return [
      {
        id: trip.id,
        name: trip.name,
        hue:
          phase.kind === "during"
            ? "var(--callout)"
            : isFeatured
              ? "var(--primary)"
              : "var(--border-strong)",
        points,
      },
    ];
  });

  const railItems: NavItem[] = [
    {
      href: "/profile",
      label: "הטיולים שלי",
      icon: <Home className="h-5 w-5" />,
      active: true,
    },
  ];

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-rail shrink-0 lg:block">
        <IconRail items={railItems} initial={user?.email?.[0]} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones get a plain bar with the wordmark; on a desktop the rail
            carries the mark and the panel carries the title. */}
        <AppHeader wide brand className="lg:hidden" trailing={<LogoutButton />} />

        <div className="relative h-[calc(100dvh-3.5rem)] min-w-0 flex-1 lg:h-dvh">
          <div className="absolute inset-0">
            <HomeMap trips={mapped} />
          </div>

          <BottomSheet desktop="floating" initial="half">
            <HomePanel
              entries={ordered}
              featured={featured}
              featuredCities={featuredCities}
              featuredDayCount={featuredDayCount}
              featuredOpen={featuredOpen}
              dayCounts={dayCounts}
              footerAction={
                <span className="hidden lg:inline-flex">
                  <LogoutButton />
                </span>
              }
            />
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}
