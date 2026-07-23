import Link from "next/link";
import { notFound } from "next/navigation";
import { CityGuide, getSavedCityGuide, getTrip } from "@/features/trips";

export default async function CityPage({
  params,
}: {
  params: Promise<{ id: string; city: string }>;
}) {
  const { id, city } = await params;
  const cityName = decodeURIComponent(city);

  const trip = await getTrip(id);
  if (!trip) {
    notFound();
  }

  // Load a previously saved guide so we skip the AI call on revisits.
  const initialGuide = await getSavedCityGuide(id, cityName);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Link
        href={`/trips/${id}`}
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← חזרה לטיול
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{cityName}</h1>
        <p className="text-sm text-muted">
          מה לעשות ב{cityName} — הצעות מפורטות
        </p>
      </header>

      <CityGuide tripId={id} city={cityName} initialGuide={initialGuide} />
    </main>
  );
}
