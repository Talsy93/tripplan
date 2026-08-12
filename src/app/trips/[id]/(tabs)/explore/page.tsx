import {
  getAddedPlaces,
  getSavedCities,
  getSelectedDestinations,
  PlaceSearch,
  PlanningPanel,
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

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">אטרקציות סביבכם</h2>
        <PlaceSearch
          tripId={id}
          cities={searchCities}
          addedPlaces={addedPlaces}
        />
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
