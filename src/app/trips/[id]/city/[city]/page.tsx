import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader, AppShell } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { CityGuide, getSavedCityGuide, getTrip } from "@/features/trips";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  return { title: `${decodeURIComponent(city)} · MyTrip` };
}

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
    // No sidebar here on purpose: this screen sits outside the (tabs) group and
    // has no tab context. It does get the header, which it had none of before.
    <AppShell header={<AppHeader brand title={trip.name} />}>
      <Link
        href={`/trips/${id}/explore`}
        className="flex items-center gap-1 self-start rounded-control text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* RTL: back points right. */}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        חזרה לטיול
      </Link>

      <SectionHeading
        level="page"
        description={`מה לעשות ב${cityName} — הצעות מפורטות`}
      >
        {cityName}
      </SectionHeading>

      <CityGuide tripId={id} city={cityName} initialGuide={initialGuide} />
    </AppShell>
  );
}
