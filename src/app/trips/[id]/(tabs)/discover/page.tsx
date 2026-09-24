import { notFound } from "next/navigation";
import { after } from "next/server";
import { discoverAround, warmDiscover } from "@/lib/discover";
import {
  DiscoverDeck,
  getSelectedDestinations,
  getTrip,
  getTripRoute,
} from "@/features/trips";
import { flagEmoji } from "@/features/trips/domain/discover";
import type { DiscoverDestination } from "@/features/trips/components/discover-deck";

export const metadata = { title: "גילוי" };

// Long enough for the background warm-up in `after()` to deal the trip's
// cities into the cache.
export const maxDuration = 60;

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
  const points = route.stops.slice(0, 4).map((stop) => ({
    city: stop.city,
    latitude: stop.latitude,
    longitude: stop.longitude,
  }));

  // The first deck, dealt into the page when it is already known, so the card
  // is there on arrival with no request from the browser at all. Waited on for
  // a moment only: a city nobody has opened yet is not worth holding the page
  // for, and the deal it started keeps running into the cache regardless —
  // the deck's own request a second later then finds it done or nearly so.
  const first = points[0];
  const initialCards = first
    ? await Promise.race([
        discoverAround({
          city: first.city,
          center: { latitude: first.latitude, longitude: first.longitude },
          category: "all",
        }).then((result) => (result.ok ? result.cards : undefined)),
        new Promise<undefined>((resolve) => setTimeout(resolve, 1_200)),
      ])
    : undefined;

  // Every other city and chip, after the page has gone out, so a press on
  // "טבע ונוף" or on the next city is served from the cache and not from a
  // cold public server.
  after(() =>
    warmDiscover(points, [
      "all",
      "mustsee",
      "nature",
      "hidden",
      "food",
      "shopping",
    ]),
  );

  return (
    <DiscoverDeck
      tripId={trip.id}
      destinations={destinations}
      initialKey={destinations[0]?.key ?? null}
      savedCount={selected.length}
      savedKeys={selected.map((item) => `${item.city}|${item.name}`)}
      initialCards={initialCards}
    />
  );
}
