import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import {
  ExploreScreen,
  getAddedPlaces,
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  RouteMapPanel,
} from "@/features/trips";

export const metadata = { title: "מה עושים?" };

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The trip itself rides along for one reason: getTripRoute takes its name as
  // geocoding context, so the map pane cannot resolve a city without it. One
  // indexed lookup by primary key, in the batch that was already running.
  const [savedCities, selected, addedPlaces, trip] = await Promise.all([
    getSavedCities(id),
    getSelectedDestinations(id),
    getAddedPlaces(id),
    getTrip(id),
  ]);

  // The destinations the search can look around — the cities things were
  // already added in.
  const searchCities = [...new Set(selected.map((item) => item.city))].filter(
    Boolean,
  );

  // The manual form suggests a wider set: a city that was only *suggested* is
  // still somewhere the user is likely to be typing a place for, even though
  // the search can't work there until something is added.
  const knownCities = [
    ...new Set([...searchCities, ...savedCities.map((city) => city.name)]),
  ].filter(Boolean);

  return (
    <ExploreScreen
      tripId={id}
      searchCities={searchCities}
      knownCities={knownCities}
      selected={selected}
      addedPlaces={addedPlaces}
      savedCities={savedCities}
      // The one thing a desktop can do here that a phone cannot: results beside
      // the map they are results on. On a phone this is two tabs and a round
      // trip between them; from 1280 up it is one screen.
      //
      // The "מפה" tab stays. It is still the right place to look at the route
      // full-screen — this pane answers "where is that?" while you are choosing,
      // which is a different question.
      //
      // Its own boundary: resolving the route may need to geocode a new city,
      // which is paced at about a request per second. The search beside it must
      // not wait for that.
      map={
        <Suspense
          // Matches RouteMapCard: a 15rem canvas over a one-line footer.
          fallback={<Skeleton className="h-[17.75rem] rounded-card" />}
        >
          <RouteMapPanel
            tripId={id}
            tripName={trip?.name ?? ""}
            variant="compact"
          />
        </Suspense>
      }
    />
  );
}
