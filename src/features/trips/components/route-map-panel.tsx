import { getTripRoute } from "../infrastructure/route-service";
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
  const route = await getTripRoute(tripId, tripName);
  return <RouteMap route={route} />;
}
