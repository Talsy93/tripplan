import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  BookingForm,
  BookingList,
  getSelectedDestinations,
  getTrip,
  listBookings,
  MoreBackLink,
  TripDatesForm,
  WeatherPanel,
} from "@/features/trips";

export default async function TripDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [selected, bookings] = await Promise.all([
    getSelectedDestinations(id),
    listBookings(id),
  ]);

  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <h2 className="font-display text-xl">פרטי הטיול</h2>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-lg">תאריכים</h3>
        <TripDatesForm
          tripId={trip.id}
          startDate={trip.start_date}
          endDate={trip.end_date}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-lg">מזג אוויר ביעדים</h3>
        <Suspense
          fallback={
            <div className="h-28 w-full animate-pulse rounded-card bg-surface-2" />
          }
        >
          <WeatherPanel trip={trip} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-lg">טיסות, רכבות ולינה</h3>
        {/* "Now" is stamped on the server so the alert badges don't disagree
            between the server and client renders. */}
        <BookingList
          tripId={trip.id}
          bookings={bookings}
          now={new Date().toISOString()}
        />
        <BookingForm tripId={trip.id} cities={cities} />
      </section>
    </>
  );
}
