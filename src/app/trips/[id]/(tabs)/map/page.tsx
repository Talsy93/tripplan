import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { getTrip, MoreBackLink, RouteMapPanel } from "@/features/trips";

export const metadata = { title: "מפה" };

// The route, full-screen (v6). In the "מפה חיה" frame this route redirected
// away, because the map was the canvas behind every tab. Stitch puts the map
// in a card on "מסלול" with a button to open it large — and this is where that
// button goes.
export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  return (
    <>
      <MoreBackLink tripId={id} href={`/trips/${id}/days`} label="למסלול" />
      <Suspense fallback={<Skeleton className="h-[70dvh] rounded-card" />}>
        <RouteMapPanel tripId={id} tripName={trip.name} />
      </Suspense>
    </>
  );
}
