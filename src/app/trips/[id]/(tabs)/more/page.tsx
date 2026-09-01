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
  const trip = await getTrip(id);
  if (!trip) notFound();

  // Five reads for five live subtitle lines. They run together, and they are the
  // whole cost of a menu that answers "is there anything I still need to do?"
  // without opening anything.
  const [bookings, gear, members, selected, shareToken] = await Promise.all([
    listBookings(id),
    listGear(id),
    listMembers(id),
    getSelectedDestinations(id),
    getShareToken(id),
  ]);

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
