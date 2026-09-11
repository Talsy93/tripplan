import { notFound } from "next/navigation";
import {
  getSelectedDestinations,
  getShareToken,
  getTrip,
  listBookings,
  listGear,
  listMembers,
  MoreMenu,
} from "@/features/trips";

export const metadata = { title: "עוד" };

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Five reads for five live subtitle lines, and the trip alongside them rather
  // than ahead of them: awaiting it first made this tab two round trips to the
  // database where one will do. Together they are the whole cost of a menu that
  // answers "is there anything I still need to do?" without opening anything.
  const [trip, bookings, gear, members, selected, shareToken] =
    await Promise.all([
      getTrip(id),
      listBookings(id),
      listGear(id),
      listMembers(id),
      getSelectedDestinations(id),
      getShareToken(id),
    ]);
  if (!trip) notFound();

  return (
    <MoreMenu
      tripId={trip.id}
      tripName={trip.name}
      bookings={bookings}
      gear={gear}
      members={members}
      cities={[...new Set(selected.map((item) => item.city))].filter(Boolean)}
      shareToken={shareToken}
      now={new Date().toISOString()}
    />
  );
}
