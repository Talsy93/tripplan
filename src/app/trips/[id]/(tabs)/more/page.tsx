import { notFound } from "next/navigation";
import { requestOrigin } from "@/lib/origin";
import {
  getSelectedDestinations,
  getShareToken,
  getTrip,
  listBookings,
  listEmergencyContacts,
  listGear,
  listMembers,
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
  // alongside them rather than ahead of them. The origin is the request's own,
  // for the family link — see ShareTrip for why it is not read from `window`.
  const [trip, bookings, gear, members, selected, shareToken, contacts, origin] =
    await Promise.all([
      getTrip(id),
      listBookings(id),
      listGear(id),
      listMembers(id),
      getSelectedDestinations(id),
      getShareToken(id),
      listEmergencyContacts(id),
      requestOrigin(),
    ]);
  if (!trip) notFound();

  return (
    <TripHub
      tripId={trip.id}
      tripName={trip.name}
      bookings={bookings}
      gear={gear}
      members={members}
      cities={[...new Set(selected.map((item) => item.city))].filter(Boolean)}
      shareToken={shareToken}
      emergencyContacts={contacts}
      origin={origin}
      now={new Date().toISOString()}
    />
  );
}
