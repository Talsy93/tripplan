import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Share2 } from "lucide-react";
import { SectionHeading, Skeleton } from "@/components/ui";
import {
  BookingForm,
  BookingList,
  ExpenseSummary,
  getSelectedDestinations,
  getTrip,
  listBookings,
  listMembers,
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

  const [selected, bookings, members] = await Promise.all([
    getSelectedDestinations(id),
    listBookings(id),
    listMembers(id),
  ]);

  // The owner is in that list, and is not somebody the trip is shared *with*.
  const shared = members.filter((member) => !member.is_owner).length;

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
          cities={cities}
          now={new Date().toISOString()}
        />
        <BookingForm tripId={trip.id} cities={cities} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">הוצאות הטיול</SectionHeading>
        <ExpenseSummary bookings={bookings} />
      </section>

      {/* Sharing used to be a panel at the bottom of this page. It now has a
          screen of its own — it grew members, roles and pending invitations, and
          none of that belongs under the expense summary. What stays here is a
          pointer, because this is where people had learned to look. */}
      <section className="flex flex-col gap-3">
        <SectionHeading level="section">שיתוף הטיול</SectionHeading>
        <Link
          href={`/trips/${trip.id}/more/share`}
          className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-soft transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
            aria-hidden="true"
          >
            <Share2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              {shared
                ? `${shared} אנשים יכולים להיכנס לטיול`
                : "הזמנת אנשים לטיול"}
            </span>
            <span className="block text-sm text-muted">
              צפייה בלבד או עריכה, לפי אימייל — או קישור פומבי בלי חשבון
            </span>
          </span>
          <ChevronLeft
            className="h-5 w-5 shrink-0 text-muted"
            aria-hidden="true"
          />
        </Link>
      </section>
    </>
  );
}
