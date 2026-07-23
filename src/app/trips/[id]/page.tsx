import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/profile" className="text-sm text-gray-500 underline">
        ← הטיולים שלי
      </Link>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{trip.name}</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {tripStatusLabels[trip.status]}
        </span>
      </header>

      <PlanningPanel tripId={trip.id} />
    </main>
  );
}
