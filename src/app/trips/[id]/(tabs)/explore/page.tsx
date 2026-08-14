import {
  getAddedPlaces,
  getSavedCities,
  getSelectedDestinations,
  ManualPlaceForm,
  PlaceSearch,
  PlanningPanel,
  savedCountsByCategory,
  SelectedList,
} from "@/features/trips";

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [savedCities, selected, addedPlaces] = await Promise.all([
    getSavedCities(id),
    getSelectedDestinations(id),
    getAddedPlaces(id),
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
    <>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl">לאן עכשיו?</h2>
          <p className="text-sm text-muted">
            מתוכנן, אופציונלי, וכל מה ששמרתם
          </p>
        </div>
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
        <h2 className="font-display text-lg">מה שבחרתם לטיול</h2>
        <SelectedList tripId={id} items={selected} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">גילוי יעדים</h2>
        <PlanningPanel tripId={id} initialCities={savedCities} />
      </section>
    </>
  );
}
