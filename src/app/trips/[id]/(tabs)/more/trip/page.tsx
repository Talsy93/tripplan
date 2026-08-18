import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  BookingForm,
  BookingList,
  getSelectedDestinations,
  getTrip,
  listBookings,
  MoreBackLink,
  PushToggle,
  TripDatesForm,
  WeatherPanel,
} from "@/features/trips";

export const metadata = { title: "פרטי הטיול" };

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
      <SectionHeading level="page">פרטי הטיול</SectionHeading>

      {/* Dates and reminders are short and unrelated to each other, so they sit
          side by side from lg and stop being two thin bands across a wide
          screen. Bookings stay full width — a boarding-pass card needs it. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeading level="section">תאריכים</SectionHeading>
          <TripDatesForm
            tripId={trip.id}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading level="section">תזכורות</SectionHeading>
          {/* Per-device, not per-trip: a subscription belongs to the browser it
              was created in, so this is the same switch on every trip page. */}
          <PushToggle />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">מזג אוויר ביעדים</SectionHeading>
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <WeatherPanel trip={trip} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">טיסות, רכבות ולינה</SectionHeading>
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
