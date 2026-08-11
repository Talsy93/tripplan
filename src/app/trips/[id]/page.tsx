import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Tabs } from "@/components/ui";
import {
  daysUntil,
  formatCountdown,
  getItinerary,
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  Itinerary,
  PlanningPanel,
  RouteMapPanel,
  SelectedList,
  TripDatesForm,
  tripStatusLabels,
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

  const [savedCities, selected, itinerary] = await Promise.all([
    getSavedCities(id),
    getSelectedDestinations(id),
    getItinerary(id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <Link
        href="/profile"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← הטיולים שלי
      </Link>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{trip.name}</h1>
        <div className="flex items-center gap-2">
          {trip.start_date && (
            <Badge className="bg-primary/10 text-primary">
              {formatCountdown(daysUntil(trip.start_date))}
            </Badge>
          )}
          <Badge>{tripStatusLabels[trip.status]}</Badge>
        </div>
      </header>

      <Tabs
        items={[
          { id: "plan", label: "תכנון" },
          { id: "map", label: "מפת מסלול" },
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
                <h2 className="text-lg font-bold">מה שבחרתם לטיול</h2>
                <SelectedList tripId={trip.id} items={selected} />
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-bold">גילוי יעדים</h2>
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
        }}
      />
    </main>
  );
}
