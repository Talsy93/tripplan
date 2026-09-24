import { notFound, redirect } from "next/navigation";
import {
  defaultTripTab,
  getItineraryDayCount,
  getSelectedDestinations,
  getTrip,
} from "@/features/trips";

// The trip's own URL is a doorway, not a page: every bookmark and every link
// from the profile lands here and is sent on to whichever tab suits the trip's
// state. Keeping it means old links never break.
//
// A trip with nothing in it yet — no place picked, no schedule — opens on
// planning instead of the route (2026-09-25). The route of an empty trip had
// one thing to press, "build", and it failed for want of places; the places
// are chosen on planning, so that is the first screen a new trip needs.
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

  const [selected, dayCount] = await Promise.all([
    getSelectedDestinations(trip.id),
    getItineraryDayCount(trip.id),
  ]);
  const empty = selected.length === 0 && !dayCount;

  redirect(`/trips/${trip.id}/${empty ? "explore" : defaultTripTab()}`);
}
