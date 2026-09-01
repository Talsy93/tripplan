import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/ui";
import {
  CityGuideList,
  getSavedCities,
  getSelectedDestinations,
  getTrip,
  MoreBackLink,
} from "@/features/trips";
import type { CityGuideEntry } from "@/features/trips";

export const metadata = { title: "מדריכי הערים" };

export default async function CityGuidesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [selected, savedCities] = await Promise.all([
    getSelectedDestinations(id),
    getSavedCities(id),
  ]);

  // Two sources, and both belong here. A city with things picked in it is
  // obviously in the trip; a city that discovery suggested and nobody has opened
  // yet is the one whose guide has never been seen — which is the row this index
  // exists for.
  //
  // Picked cities first, in the order they were added, then the rest.
  const picked = new Map<string, number>();
  for (const item of selected) {
    if (!item.city) continue;
    picked.set(item.city, (picked.get(item.city) ?? 0) + 1);
  }

  const described = new Map(
    savedCities.map((city) => [city.name, city.description] as const),
  );

  const entries: CityGuideEntry[] = [
    ...[...picked.entries()].map(([city, count]) => ({
      city,
      picked: count,
      description: described.get(city) ?? null,
    })),
    ...savedCities
      .filter((city) => !picked.has(city.name))
      .map((city) => ({
        city: city.name,
        picked: 0,
        description: city.description,
      })),
  ];

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="לכל עיר בטיול יש מדריך: אזורי לינה, מסעדות, אטרקציות וחוויות."
      >
        מדריכי הערים
      </SectionHeading>
      <CityGuideList tripId={trip.id} entries={entries} />
    </>
  );
}
