import { notFound } from "next/navigation";
import {
  APP_TIME_ZONE,
  getSelectedDestinations,
  getShareToken,
  getTrip,
  listBookings,
  listEmergencyContacts,
  listGear,
  listMembers,
  listPrepItems,
  suggestPrepItems,
  todayIn,
  TripHub,
} from "@/features/trips";

export const metadata = { title: "מסמכים" };

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Every read the screen draws from, in one round trip, with the trip
  // alongside them rather than ahead of them.
  const [
    trip,
    bookings,
    gear,
    members,
    selected,
    shareToken,
    contacts,
    prepItems,
  ] =
    await Promise.all([
      getTrip(id),
      listBookings(id),
      listGear(id),
      listMembers(id),
      getSelectedDestinations(id),
      getShareToken(id),
      listEmergencyContacts(id),
      listPrepItems(id),
    ]);
  if (!trip) notFound();

  // The same suggestions the reminders list always offered, now as chips in
  // the add modal of the documents checklist.
  const prepSuggestions = suggestPrepItems({
    bookings,
    startDate: trip.start_date,
    existing: prepItems,
    isShared:
      shareToken !== null ||
      members.filter((member) => !member.is_owner).length > 0,
    hasGear: gear.length > 0,
    pushEnabled: false,
  });

  return (
    <TripHub
      tripId={trip.id}
      tripName={trip.name}
      bookings={bookings}
      gear={gear}
      prepItems={prepItems}
      prepSuggestions={prepSuggestions}
      today={todayIn(APP_TIME_ZONE, new Date())}
      cities={[...new Set(selected.map((item) => item.city))].filter(Boolean)}
      emergencyContacts={contacts}
      now={new Date().toISOString()}
    />
  );
}
