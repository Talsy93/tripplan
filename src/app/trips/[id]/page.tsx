import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { getTrip, PlanningPanel, tripStatusLabels } from "@/features/trips";

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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
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

      <PlanningPanel tripId={trip.id} />
    </main>
  );
}
