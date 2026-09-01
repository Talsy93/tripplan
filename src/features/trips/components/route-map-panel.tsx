import { getItinerary } from "../infrastructure/itinerary-service";
import { getTripRoute } from "../infrastructure/route-service";
import { RouteMap } from "./route-map";
import { RouteMapCard } from "./route-map-card";

// Server component: resolves the route (which may need to geocode new cities,
// paced at ~1 request/second) and hands it to the client map. Wrap it in a
// <Suspense> so a slow first lookup streams in instead of blocking the page.
export async function RouteMapPanel({
  tripId,
  tripName,
  // "full" is the מפה tab: the map is the screen. "compact" is a context
  // pane beside something else, and it is a different component rather than
  // the same one with a height override — see route-map-card.tsx for why.
  variant = "full",
}: {
  tripId: string;
  // Geocoding context — see getTripRoute().
  tripName: string;
  variant?: "full" | "compact";
}) {
  // The itinerary decides both the order of the stops and the nights spent in
  // each, so it has to be loaded before the route is built.
  const itinerary = await getItinerary(tripId);
  const route = await getTripRoute(tripId, tripName, itinerary);

  // RouteHero used to open this panel with the trip's name over a photo of its
  // first stop. TripAuraBand now does exactly that at the top of every screen
  // inside a trip, so on this tab there were two dark panels stacked, both
  // naming the trip and both showing the same photo. The band is the one that
  // belongs — it is on all ten tabs, so removing it here would have left the
  // map as the only screen that opened differently.
  //
  // This also drops a getPlaceImage call from the tab: the band already made it.

  if (variant === "compact") {
    return (
      <RouteMapCard
        tripId={tripId}
        stops={route.stops}
        places={route.places}
        unlocatedCount={route.unlocatedCities.length}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <RouteMap
        tripId={tripId}
        route={route}
        itinerary={itinerary}
        tripName={tripName}
      />
    </div>
  );
}
