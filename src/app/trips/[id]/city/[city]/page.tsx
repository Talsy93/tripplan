import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader, AppShell } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import {
  assignTripAuras,
  CityGuide,
  getSavedCityGuide,
  getSelectedCitiesByTrip,
  getTrip,
  listTrips,
  RailTripSwitcher,
  TripSideNav,
  tripHueStyle,
  APP_TIME_ZONE,
  getItineraryDayCount,
  RailTripProgress,
  todayIn,
  tripPhase,
} from "@/features/trips";

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

  // The guide, and everything the rail needs. T7 found this screen opening
  // without a rail at all — the same defect T6 had just fixed on the home
  // screen, one level down: coming here from "עוד → מדריכי הערים" moved the
  // whole frame 248px sideways.
  //
  // listTrips + getSelectedCitiesByTrip look like more than a rail needs, and
  // they are the same reads the (tabs) layout does for the same reason: a trip's
  // light is assigned across the whole list (domain/aura.ts), so the only way
  // this rail shows the colour the tab bar behind it shows is to run the same
  // assignment.
  const [initialGuide, citiesByTrip, trips, dayCount, user] = await Promise.all(
    [
      getSavedCityGuide(id, cityName),
      getSelectedCitiesByTrip(),
      listTrips(),
      getItineraryDayCount(id),
      getCurrentUser(),
    ],
  );

  const hues =
    assignTripAuras(
      trips.map((other) => ({
        id: other.id,
        cities: citiesByTrip.get(other.id) ?? [],
        createdAt: other.created_at,
      })),
    ).get(trip.id) ?? [];

  const phase = tripPhase(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
    dayCount,
  );

  return (
    <AppShell
      // No `brand`: the rail carries the wordmark now, the same as everywhere
      // else in the app.
      header={<AppHeader title={trip.name} />}
      // No tab is current — this screen is a level below all five, and the rail
      // says so by lighting none of them. What it is here for is that the frame
      // does not move when you arrive.
      sidebar={
        <TripSideNav
          tripId={trip.id}
          hues={hues}
          initial={user?.email?.[0]}
          header={<RailTripSwitcher name={trip.name} phase={phase} />}
          footer={
            <RailTripProgress
              phase={phase}
              dayCount={dayCount}
              startDate={trip.start_date}
            />
          }
        />
      }
    >
      {/* The trip's light, published to the guide below as CSS variables — the
          same thing the (tabs) layout does for its own children. Without it a
          lit panel down here would fall back to the neutral base. */}
      <div className="contents" style={tripHueStyle(hues)}>
        {/* Back to the index of city guides, which is where this screen is
            reached from since T5 gave the guides a list of their own. */}
        <Link
          href={`/trips/${id}/more/guides`}
          className="flex items-center gap-1 self-start rounded-control text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* RTL: back points right. */}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          חזרה למדריכי הערים
        </Link>

        <SectionHeading
          level="page"
          description={`מה לעשות ב${cityName} — הצעות מפורטות`}
        >
          {cityName}
        </SectionHeading>

        <CityGuide tripId={id} city={cityName} initialGuide={initialGuide} />
      </div>
    </AppShell>
  );
}
