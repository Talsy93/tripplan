import { notFound } from "next/navigation";
import { after } from "next/server";
import { discoverAround, warmDiscover } from "@/lib/discover";
import { normaliseName } from "@/lib/text";
import {
  DiscoverDeck,
  getItinerary,
  getSelectedDestinations,
  getTrip,
  getTripRoute,
  PlanSwitch,
  SelectedList,
} from "@/features/trips";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
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
  const [route, selected, itinerary] = await Promise.all([
    getTripRoute(trip.id, trip.name),
    getSelectedDestinations(trip.id),
    getItinerary(trip.id),
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

  // Every other city, after the page has gone out, so a press on the next city
  // is served from the cache and not from a cold public server. One deal per
  // city: it holds every chip's cards (PER_CHIP in lib/discover.ts).
  after(() => warmDiscover(points, ["all"]));

  // PN21 (Pencil discover-desktop): from @4xl the places saved so far sit in a
  // pane beside the deck — what the swiping has added up to, and the way on to
  // scheduling it. Below that the deck is the whole screen, as it was; the
  // counter under the deck already says how many were saved.
  const saved = selected.filter((item) => item.city);

  return (
    <div className="@4xl:grid @4xl:grid-cols-[minmax(0,1fr)_23.25rem] @4xl:items-start @4xl:gap-8">
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <PlanSwitch tripId={trip.id} active="discover" />
      <DiscoverDeck
        tripId={trip.id}
        destinations={destinations}
        initialKey={destinations[0]?.key ?? null}
        savedCount={selected.length}
        savedKeys={selected.map((item) => `${item.city}|${item.name}`)}
        // What is already on some day is not dealt again.
        scheduledNames={[
          ...new Set(itinerary.flatMap((day) => day.items.map((item) => normaliseName(item.title)))),
        ]}
        initialCards={initialCards}
      />
    </div>

      <aside
        aria-labelledby="saved-heading"
        className="hidden flex-col gap-4 @4xl:sticky @4xl:top-16 @4xl:flex"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="saved-heading" className="text-lg font-bold leading-6">
            נשמרו לטיול
          </h2>
          <span className="rounded-full bg-success-tint px-2.5 py-0.5 text-sm font-semibold tabular-nums text-success-ink">
            {saved.length}
          </span>
        </div>
        <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto">
          <SelectedList tripId={trip.id} items={saved} />
        </div>
        {saved.length > 0 && (
          <Link
            href={`/trips/${trip.id}/explore`}
            className="inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-semibold text-cta-foreground shadow-lift transition-colors hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
            שיבוץ המקומות לימים
          </Link>
        )}
      </aside>
    </div>
  );
}
