import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import {
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  PlanningPanel,
  SelectedList,
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

  const [savedCities, selected] = await Promise.all([
    getSavedCities(id),
    getSelectedDestinations(id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <Link
        href="/profile"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← הטיולים שלי
      </Link>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{trip.name}</h1>
        <Badge>{tripStatusLabels[trip.status]}</Badge>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">מה שבחרתם לטיול</h2>
        <SelectedList items={selected} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">גילוי יעדים</h2>
        <PlanningPanel tripId={trip.id} initialCities={savedCities} />
      </section>
    </main>
  );
}
