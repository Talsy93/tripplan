import { Suspense } from "react";
import { TwoPane } from "@/components/layout";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  getAddedPlaces,
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  ManualPlaceForm,
  PlaceSearch,
  PlanningPanel,
  RouteMapPanel,
  savedCountsByCategory,
  SelectedList,
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
    <TwoPane
      // The one thing a desktop can do here that a phone cannot: results beside
      // the map they are results on. On a phone this is two tabs and a round
      // trip between them; from 1280 up it is one screen.
      //
      // The "מפה" tab stays. It is still the right place to look at the route
      // full-screen — this pane answers "where is that?" while you are choosing,
      // which is a different question.
      aside={
        <section className="flex flex-col gap-3">
          <SectionHeading level="section">איפה זה</SectionHeading>
          {/* Its own boundary: resolving the route may need to geocode a new
              city, which is paced at about a request per second. The search
              above must not wait for that. */}
          <Suspense
            fallback={
              <div className="flex flex-col gap-2">
                <Skeleton className="h-[20rem] rounded-tile" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            }
          >
            <RouteMapPanel tripId={id} tripName={trip?.name ?? ""} />
          </Suspense>
        </section>
      }
    >
      <section className="flex flex-col gap-4">
        <SectionHeading
          level="section"
          description="מתוכנן, אופציונלי, וכל מה ששמרתם"
        >
          לאן עכשיו?
        </SectionHeading>
        <PlaceSearch
          tripId={id}
          cities={searchCities}
          addedPlaces={addedPlaces}
          savedCounts={savedCountsByCategory(selected)}
        />
        {/* Sits under the search on purpose, including when the search is an
            empty state: on a trip with no cities yet this form is the only way
            to add anything by hand, and it creates the first city itself. */}
        <ManualPlaceForm tripId={id} cities={knownCities} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level="section">מה שבחרתם לטיול</SectionHeading>
        <SelectedList tripId={id} items={selected} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          level="section"
          description="תארו את הטיול ותקבלו יעדים להתחיל מהם"
        >
          גילוי יעדים
        </SectionHeading>
        <PlanningPanel tripId={id} initialCities={savedCities} />
      </section>
    </TwoPane>
  );
}
