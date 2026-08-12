import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  BookingForm,
  BookingList,
  getPhrasebook,
  getSelectedDestinations,
  getTrip,
  listBookings,
  listChatMessages,
  Phrasebook,
  TripChat,
  TripDatesForm,
  WeatherPanel,
} from "@/features/trips";

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [selected, bookings, phrasebook, chatMessages] = await Promise.all([
    getSelectedDestinations(id),
    listBookings(id),
    getPhrasebook(id),
    listChatMessages(id),
  ]);

  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">תאריכי הטיול</h2>
        <TripDatesForm
          tripId={trip.id}
          startDate={trip.start_date}
          endDate={trip.end_date}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">מזג אוויר ביעדים</h2>
        <Suspense
          fallback={
            <div className="h-28 w-full animate-pulse rounded-card bg-surface-2" />
          }
        >
          <WeatherPanel trip={trip} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">טיסות, רכבות ולינה</h2>
        {/* "Now" is stamped on the server so the alert badges don't disagree
            between the server and client renders. */}
        <BookingList
          tripId={trip.id}
          bookings={bookings}
          now={new Date().toISOString()}
        />
        <BookingForm tripId={trip.id} cities={cities} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">מילים שימושיות</h2>
        <Phrasebook tripId={trip.id} initialPhrasebook={phrasebook} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">שיחה</h2>
        <TripChat tripId={trip.id} initialMessages={chatMessages} />
      </section>
    </>
  );
}
