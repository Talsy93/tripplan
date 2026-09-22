import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CloudSun, Wallet } from "lucide-react";
import { Disclosure, SectionHeading, Skeleton } from "@/components/ui";
import {
  AddBookingButton,
  BookingList,
  ExpenseSummary,
  getSelectedDestinations,
  getTrip,
  listBookings,
  MoreBackLink,
  PushToggle,
  TripDatesForm,
  TripNameButton,
  WeatherPanel,
} from "@/features/trips";

export const metadata = { title: "פרטי הטיול" };

export default async function TripDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The trip joins the wave rather than gating it — see /more/gear for why.
  const [trip, selected, bookings] = await Promise.all([
    getTrip(id),
    getSelectedDestinations(id),
    listBookings(id),
  ]);
  if (!trip) notFound();

  const cities = [...new Set(selected.map((item) => item.city))].filter(
    Boolean,
  );

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading level="page">פרטי הטיול</SectionHeading>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">שם הטיול</SectionHeading>
        <TripNameButton tripId={trip.id} name={trip.name} variant="row" />
      </section>

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

      {/* Folded, like the expenses below it. Neither is what this page is for —
          it is where you fix the name, the dates and the bookings — and both
          were full-height panels between the reader and the next thing they
          came to edit. The heading says which destinations are covered, which
          is the part worth reading without opening anything. */}
      <Disclosure
        leading={<CloudSun className="h-4 w-4" />}
        title="מזג אוויר ביעדים"
        detail={cities.length > 0 ? cities.join(", ") : undefined}
      >
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <WeatherPanel trip={trip} />
        </Suspense>
      </Disclosure>

      <section className="flex flex-col gap-3">
        {/* The add button sits in the heading, not under the list.
            Reported: it disappeared off the bottom of the screen. It was after
            the list, so the more bookings a trip had the further you had to
            scroll to add another — the one control whose reachability should
            not depend on how much is already there. In the heading it is at a
            fixed place, above the thing it adds to. */}
        <SectionHeading
          level="section"
          actions={<AddBookingButton tripId={trip.id} cities={cities} />}
        >
          טיסות, רכבות ולינה
        </SectionHeading>
        {/* "Now" is stamped on the server so the alert badges don't disagree
            between the server and client renders. */}
        <BookingList
          tripId={trip.id}
          bookings={bookings}
          cities={cities}
          now={new Date().toISOString()}
        />
      </section>

      <Disclosure
        leading={<Wallet className="h-4 w-4" />}
        title="הוצאות הטיול"
        detail="סיכום לפי מטבע ויעד, מתוך ההזמנות שלמעלה"
      >
        <ExpenseSummary bookings={bookings} />
      </Disclosure>

      {/* Sharing and deletion both used to end this page. Sharing has had a
          screen of its own since it grew members and roles, and deletion moved
          to the card at the bottom of the "עוד" menu in T5 — the design puts it
          there, separated from the seven rows above it, and two screens deep was
          "at the bottom of a dedicated page" in letter only. Both are one tap
          from here: the menu is the back link at the top. */}
    </>
  );
}
