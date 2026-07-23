import Link from "next/link";
import { notFound } from "next/navigation";
import { CityGuide, getTrip } from "@/features/trips";

export default async function CityPage({
  params,
}: {
  params: Promise<{ id: string; city: string }>;
}) {
  const { id, city } = await params;
  const cityName = decodeURIComponent(city);

  // Confirm the trip exists and belongs to the user before showing anything.
  const trip = await getTrip(id);
  if (!trip) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href={`/trips/${id}`} className="text-sm text-gray-500 underline">
        ← חזרה לטיול
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{cityName}</h1>
        <p className="text-sm text-gray-500">
          מה לעשות ב{cityName} — הצעות מפורטות
        </p>
      </header>

      <CityGuide city={cityName} />
    </main>
  );
}
