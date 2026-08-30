import { getPlaceImage } from "@/lib/place-image";
import { getItinerary } from "../infrastructure/itinerary-service";
import { getTripRoute } from "../infrastructure/route-service";
import { RouteHero } from "./route-hero";
import { RouteMap } from "./route-map";

// Server component: resolves the route (which may need to geocode new cities,
// paced at ~1 request/second) and hands it to the client map. Wrap it in a
// <Suspense> so a slow first lookup streams in instead of blocking the page.
export async function RouteMapPanel({
  tripId,
  tripName,
}: {
  tripId: string;
  // Geocoding context — see getTripRoute().
  tripName: string;
}) {
  // The itinerary decides both the order of the stops and the nights spent in
  // each, so it has to be loaded before the route is built.
  const itinerary = await getItinerary(tripId);
  const route = await getTripRoute(tripId, tripName, itinerary);

  // The trip's opening image is the first place it goes. Null when Wikipedia
  // has no photo — RouteHero falls back to a gradient.
  const firstStop = route.stops[0]?.city;
  const imageUrl = firstStop ? await getPlaceImage(firstStop) : null;

  return (
    <div className="flex flex-col gap-5">
      {route.stops.length > 0 && (
        <RouteHero
          tripName={tripName}
          stops={route.stops}
          imageUrl={imageUrl}
        />
      )}
      <RouteMap
        tripId={tripId}
        route={route}
        itinerary={itinerary}
        tripName={tripName}
      />
    </div>
  );
}
