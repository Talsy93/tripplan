import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Tabs } from "@/components/ui";
import { getPlaceImage } from "@/lib/place-image";
import {
  BookingForm,
  BookingList,
  CountdownHero,
  getAddedPlaces,
  getItinerary,
  getSavedCities,
  getSelectedDestinations,
  getPhrasebook,
  getTrip,
  Itinerary,
  itineraryStops,
  listBookings,
  listChatMessages,
  PlaceSearch,
  Phrasebook,
  PlanningPanel,
  RouteMapPanel,
  SelectedList,
  TripChat,
  TripDatesForm,
  tripStatusLabels,
  WeatherPanel,
} from "@/features/trips";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  const [
    savedCities,
    selected,
    itinerary,
    addedPlaces,
    bookings,
    phrasebook,
    chatMessages,
  ] = await Promise.all([
    getSavedCities(id),
    getSelectedDestinations(id),
    getItinerary(id),
    getAddedPlaces(id),
    listBookings(id),
    getPhrasebook(id),
    listChatMessages(id),
  ]);

  // The destinations the search can look around — the cities the user has
  // already added things in.
  const searchCities = [...new Set(selected.map((item) => item.city))].filter(
    Boolean,
  );

  // Route order for the hero's chips: the itinerary decides it once one
  // exists, otherwise the order cities were added. Same rule as the profile
  // card, so a city keeps its colour across both screens.
  const stops = itineraryStops(itinerary);
  const routeCities = stops.length > 0 ? stops.map((s) => s.city) : searchCities;
  const heroImage = await getPlaceImage(routeCities[0] ?? trip.name);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <Link
        href="/profile"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← הטיולים שלי
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="sr-only">{trip.name}</h1>
        <CountdownHero
          tripId={trip.id}
          name={trip.name}
          startDate={trip.start_date}
          imageUrl={heroImage}
          cities={routeCities}
        />
        <div className="flex justify-end">
          <Badge>{tripStatusLabels[trip.status]}</Badge>
        </div>
      </header>

      <Tabs
        items={[
          { id: "plan", label: "תכנון" },
          { id: "map", label: "מפת מסלול" },
          { id: "places", label: "אטרקציות" },
          { id: "logistics", label: "לוגיסטיקה" },
          { id: "phrases", label: "מילים שימושיות" },
          { id: "chat", label: "שיחה" },
        ]}
        panels={{
          plan: (
            <div className="flex flex-col gap-8">
              <TripDatesForm
                tripId={trip.id}
                startDate={trip.start_date}
                endDate={trip.end_date}
              />

              <Itinerary tripId={trip.id} initialItinerary={itinerary} />

              <section className="flex flex-col gap-4">
                <h2 className="font-display text-lg">מה שבחרתם לטיול</h2>
                <SelectedList tripId={trip.id} items={selected} />
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="font-display text-lg">גילוי יעדים</h2>
                <PlanningPanel tripId={trip.id} initialCities={savedCities} />
              </section>
            </div>
          ),
          map: (
            <Suspense
              fallback={
                <div className="h-[26rem] w-full animate-pulse rounded-2xl bg-surface-2" />
              }
            >
              <RouteMapPanel tripId={trip.id} tripName={trip.name} />
            </Suspense>
          ),
          places: (
            <PlaceSearch
              tripId={trip.id}
              cities={searchCities}
              addedPlaces={addedPlaces}
            />
          ),
          logistics: (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-lg">מזג אוויר ביעדים</h2>
                <Suspense
                  fallback={
                    <div className="h-28 w-full animate-pulse rounded-2xl bg-surface-2" />
                  }
                >
                  <WeatherPanel trip={trip} />
                </Suspense>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="font-display text-lg">טיסות, רכבות ולינה</h2>
                {/* "Now" is stamped on the server so the alert badges don't
                    disagree between the server and client renders. */}
                <BookingList
                  tripId={trip.id}
                  bookings={bookings}
                  now={new Date().toISOString()}
                />
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="font-display text-lg">הוספה</h2>
                <BookingForm tripId={trip.id} cities={searchCities} />
              </section>
            </div>
          ),
          phrases: (
            <Phrasebook tripId={trip.id} initialPhrasebook={phrasebook} />
          ),
          chat: <TripChat tripId={trip.id} initialMessages={chatMessages} />,
        }}
      />
    </main>
  );
}
