import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  APP_TIME_ZONE,
  daysUntil,
  forecastWindow,
  GearList,
  getShareToken,
  getSelectedDestinations,
  getItinerary,
  getTrip,
  itineraryStops,
  listBookings,
  listGear,
  listMembers,
  listPrepItems,
  MoreBackLink,
  suggestPrepItems,
  todayIn,
  TodayPrep,
  tripOpenItems,
  WeatherPanel,
} from "@/features/trips";

export const metadata = { title: "רשימות והכנות" };

// The preparations and the packing list, on one page.
//
// They were two: this page held the packing list, and the "היום" tab — before
// the trip started — held a countdown, the prep checklist and what was still
// open. Reported as exactly the duplication it was, so the two became one and
// the "היום" tab now waits for a today to exist (see TRIP_TABS). /today
// redirects here in the meantime, so nothing that pointed at it breaks.
//
// The reads are the wave the "היום" tab used to make, minus the ones only the
// during-trip screen needs. They go out together and cost one round trip.
export default async function ListsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    trip,
    gear,
    itinerary,
    selected,
    bookings,
    prepItems,
    shareToken,
    members,
  ] = await Promise.all([
    getTrip(id),
    listGear(id),
    getItinerary(id),
    getSelectedDestinations(id),
    listBookings(id),
    listPrepItems(id),
    getShareToken(id),
    listMembers(id),
  ]);
  if (!trip) notFound();

  const now = new Date();
  const today = todayIn(APP_TIME_ZONE, now);
  const dayCount = itinerary.length;

  const stops = itineraryStops(itinerary);
  const cities =
    stops.length > 0
      ? stops.map((stop) => stop.city)
      : [...new Set(selected.map((item) => item.city).filter(Boolean))];

  const open = tripOpenItems({
    startDate: trip.start_date,
    daysUntilStart: trip.start_date ? daysUntil(trip.start_date) : null,
    dayCount,
    cities,
    itinerary,
    bookings,
    // So "chosen but not in the schedule" can be noticed. Already read above.
    selectedNames: selected.map((item) => item.name),
  });

  const suggestions = suggestPrepItems({
    bookings,
    startDate: trip.start_date,
    existing: prepItems,
    isShared:
      shareToken !== null ||
      members.filter((member) => !member.is_owner).length > 0,
    hasGear: gear.length > 0,
    // Whether this device has push turned on is not known on the server; the
    // suggestion stays and is one tap to dismiss.
    pushEnabled: false,
  });

  const hasForecast =
    forecastWindow(trip.start_date, trip.end_date, today).kind === "available";

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="מה שצריך לעשות לפני היציאה, ומה שצריך לארוז. שום דבר כאן לא נוצר או נמחק אוטומטית."
      >
        רשימות והכנות
      </SectionHeading>

      <TodayPrep
        tripId={trip.id}
        tripName={trip.name}
        startDate={trip.start_date}
        today={today}
        bookings={bookings}
        now={now.toISOString()}
        cities={cities}
        open={open}
        prepItems={prepItems}
        suggestions={suggestions}
        forecast={
          hasForecast ? (
            <Suspense fallback={<Skeleton className="h-28 rounded-card" />}>
              <WeatherPanel trip={trip} />
            </Suspense>
          ) : undefined
        }
      >
        {/* In the same column as the checklist above it, not on a page of its
            own. Packing is one more thing left to do before leaving, and that
            is the whole subject of this page. */}
        <section className="flex flex-col gap-3">
          <SectionHeading level="section" tone="action">
            ציוד ואריזה
          </SectionHeading>
          <GearList tripId={trip.id} items={gear} />
        </section>
      </TodayPrep>
    </>
  );
}
