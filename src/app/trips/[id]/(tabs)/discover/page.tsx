import { notFound } from "next/navigation";
import {
  DiscoverDeck,
  getSelectedDestinations,
  getTrip,
  getTripRoute,
} from "@/features/trips";
import { flagEmoji } from "@/features/trips/domain/discover";
import type { DiscoverDestination } from "@/features/trips/components/discover-deck";

export const metadata = { title: "גילוי" };

// The "גילוי" tab: a swipe deck of attractions around one of the trip's
// cities, or across every city of one of its countries. The page only works
// out what can be chosen; the deck deals itself from /api/discover.
export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  // The route is what knows each city's country (cached with its
  // coordinates), in the order the trip visits them.
  const [route, selected] = await Promise.all([
    getTripRoute(trip.id, trip.name),
    getSelectedDestinations(trip.id),
  ]);

  const cities: DiscoverDestination[] = [
    ...route.stops.map((stop) => ({
      key: `city:${stop.city}`,
      label: stop.city,
      cities: [stop.city],
      flag: flagEmoji(stop.countryCode),
      kind: "city" as const,
    })),
    ...route.unlocatedCities.map((city) => ({
      key: `city:${city}`,
      label: city,
      cities: [city],
      flag: flagEmoji(null),
      kind: "city" as const,
    })),
  ];

  // A country is offered only when it holds more than one of the trip's
  // cities — with one, it is that city again under another name.
  const byCountry = new Map<string, { name: string; code: string; cities: string[] }>();
  for (const stop of route.stops) {
    if (!stop.country || !stop.countryCode) continue;
    const entry = byCountry.get(stop.countryCode) ?? {
      name: stop.country,
      code: stop.countryCode,
      cities: [],
    };
    entry.cities.push(stop.city);
    byCountry.set(stop.countryCode, entry);
  }
  const countries: DiscoverDestination[] = [...byCountry.values()]
    .filter((entry) => entry.cities.length > 1)
    .map((entry) => ({
      key: `country:${entry.code}`,
      label: entry.name,
      cities: entry.cities,
      flag: flagEmoji(entry.code),
      kind: "country" as const,
    }));

  const destinations = [...cities, ...countries];

  return (
    <DiscoverDeck
      tripId={trip.id}
      destinations={destinations}
      initialKey={destinations[0]?.key ?? null}
      savedCount={selected.length}
      savedKeys={selected.map((item) => `${item.city}|${item.name}`)}
    />
  );
}
