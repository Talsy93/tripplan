import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout";
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
    <AppShell>
      <Link
        href={`/trips/${id}/explore`}
        className="flex items-center gap-1 self-start text-sm text-muted transition-colors hover:text-foreground"
      >
        {/* RTL: back points right. */}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        חזרה לטיול
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl">{cityName}</h1>
        <p className="text-sm text-muted">
          מה לעשות ב{cityName} — הצעות מפורטות
        </p>
      </header>

      <CityGuide tripId={id} city={cityName} initialGuide={initialGuide} />
    </AppShell>
  );
}
