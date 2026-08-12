import { notFound, redirect } from "next/navigation";
import { defaultTripTab, getTrip } from "@/features/trips";

// The trip's own URL is a doorway, not a page: every bookmark and every link
// from the profile lands here and is sent on to whichever tab suits the trip's
// state. Keeping it means old links never break.
export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  redirect(`/trips/${trip.id}/${defaultTripTab(trip.start_date)}`);
}
