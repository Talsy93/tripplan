import { redirect } from "next/navigation";

// "פרטי הטיול" is gone (2026-09-23): the name and the dates are edited from the
// header ("עריכת הטיול"), and the bookings, the device reminders and the
// expenses live on the documents tab. Kept as a redirect so old links — a push
// notification, a bookmark — still land somewhere that has what they meant.
export default async function TripDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/trips/${id}/more`);
}
