import { getItinerary } from "@/features/trips";
import { Itinerary } from "@/features/trips";

export default async function DaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const itinerary = await getItinerary(id);

  return <Itinerary tripId={id} initialItinerary={itinerary} />;
}
