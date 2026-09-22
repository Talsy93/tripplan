import { AppHeader, IconRail } from "@/components/layout";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  APP_TIME_ZONE,
  daysUntil,
  getCachedStopsByTrip,
  getItinerary,
  getItineraryDayCountByTrip,
  getSelectedDestinations,
  HomeScreen,
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
//
// The map and the panel are two halves of one thing — pressing a trip in the
// list lights it up on the map — so they are composed by HomeScreen, a client
// shell that owns the selection and nothing else. Everything below is still
// fetched and rendered here, on the server.
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

  // Two colours per trip, and the split is the point.
  //
  // `hue` is the resting map: one colour per *standing*, not per trip — the
  // trip being lived is amber, the next one out is blue, everything else is
  // quiet grey, and the number in the panel does the naming. `activeHue` is
  // what the trip wears once it has been selected, which is the only way a
  // grey trip can come forward without every trip needing a colour of its own.
  //
  // `position` is the row number in the panel. Indexed into `ordered` rather
  // than into this list, because a trip with no located city takes a number
  // here and no flag.
  const mapped: MappedTrip[] = ordered.flatMap(({ trip, phase }, index) => {
    const points = pointsByTrip.get(trip.id) ?? [];
    if (points.length === 0) return [];
    const isFeatured = trip.id === featured?.trip.id;
    const during = phase.kind === "during";
    return [
      {
        id: trip.id,
        name: trip.name,
        hue: during
          ? "var(--callout)"
          : isFeatured
            ? "var(--primary)"
            : "var(--border-strong)",
        activeHue: during ? "var(--callout)" : "var(--primary)",
        position: index + 1,
        points,
      },
    ];
  });

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-rail shrink-0 lg:block">
        {/* The wordmark is the home control; no second item for the same
            screen. Sections of the app that are not a trip go here later. */}
        <IconRail items={[]} initial={user?.email?.[0]} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones get a plain bar with the wordmark; on a desktop the rail
            carries the mark and the panel carries the title. */}
        <AppHeader wide brand className="lg:hidden" trailing={<LogoutButton />} />

        <HomeScreen
          mapped={mapped}
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
      </div>
    </div>
  );
}
