import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  buildSchedulingPlan,
  cityDayPlan,
  ExploreScreen,
  getAddedPlaces,
  getItinerary,
  getSavedCities,
  getSavedCityGuide,
  getSelectedDestinations,
  getTrip,
  listBookings,
  listCityDays,
  lodgingByDay,
  PopularCities,
  RouteMapPanel,
  tripDayCount,
} from "@/features/trips";

export const metadata = { title: "תכנון הטיול" };

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // `?day=N` — מסלול links an empty day here.
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;

  // The trip rides along for the map (getTripRoute takes its name as geocoding
  // context) and for its dates, which "המסלול כולו" and the day list need. The
  // itinerary, the bookings and the per-city overrides are the rest of what
  // מסלול's route pane used to load — that section lives here now.
  const [savedCities, selected, addedPlaces, trip, itinerary, bookings, overrides] =
    await Promise.all([
      getSavedCities(id),
      getSelectedDestinations(id),
      getAddedPlaces(id),
      getTrip(id),
      getItinerary(id),
      listBookings(id),
      listCityDays(id),
    ]);

  // The destinations the search can look around — the cities things were
  // already added in. Also the route's cities, in the order every other surface
  // colours them in.
  const pickedCities = [...new Set(selected.map((item) => item.city))].filter(
    Boolean,
  );
  // Before anything is picked, the cities the trip was given (a popular city
  // added from the name, or the AI's suggestions) are where the search looks —
  // otherwise a new trip's category grid had no city and did nothing.
  const searchCities =
    pickedCities.length > 0
      ? pickedCities
      : [...new Set(savedCities.map((city) => city.name))].filter(Boolean).slice(0, 8);

  // The saved guide for the first destination, which feeds "מומלצים ב<עיר>".
  // A second read and not part of the wave above, because it needs a city out
  // of the first one's answer. Null when nothing has been generated yet, and
  // then the section does not draw.
  const cityGuide = searchCities[0]
    ? await getSavedCityGuide(id, searchCities[0])
    : null;

  // The manual form suggests a wider set: a city that was only *suggested* is
  // still somewhere the user is likely to be typing a place for, even though
  // the search can't work there until something is added.
  const knownCities = [
    ...new Set([...searchCities, ...savedCities.map((city) => city.name)]),
  ].filter(Boolean);

  const startDate = trip?.start_date ?? null;
  const dayCount = trip ? tripDayCount(trip.start_date, trip.end_date) : null;

  // Where the trip sleeps each night — names the city of a day with nothing on
  // it yet. The same zone-pinned computation מסלול uses.
  const lodgingCity = new Map<number, string>();
  for (const [dayNumber, stay] of lodgingByDay(
    bookings,
    startDate,
    Math.max(dayCount ?? 0, itinerary.length),
    APP_TIME_ZONE,
  )) {
    if (stay.booking.city) lodgingCity.set(dayNumber, stay.booking.city);
  }

  const plan = buildSchedulingPlan({
    itinerary,
    selected,
    startDate,
    dayCount,
    lodgingCity,
  });

  const focusDay = day && /^\d{1,3}$/.test(day) ? Number(day) : null;

  return (
    <ExploreScreen
      tripId={id}
      searchCities={searchCities}
      knownCities={knownCities}
      selected={selected}
      addedPlaces={addedPlaces}
      savedCities={savedCities}
      cityGuide={cityGuide}
      cityDays={cityDayPlan(pickedCities, bookings, overrides, APP_TIME_ZONE)}
      tripDayCount={dayCount}
      plan={plan}
      focusDay={focusDay}
      start={
        selected.length === 0 ? (
          <Suspense fallback={null}>
            <PopularCities
              tripId={id}
              tripName={trip?.name ?? ""}
              exclude={savedCities.map((city) => city.name)}
            />
          </Suspense>
        ) : undefined
      }
      // The one thing a desktop can do here that a phone cannot: results beside
      // the map they are results on. Its own boundary: resolving the route may
      // need to geocode a new city, paced at about a request per second, and
      // the search beside it must not wait for that.
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
