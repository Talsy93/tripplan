import { redirect } from "next/navigation";
import { tripTabHref } from "@/features/trips";

// The map is no longer a tab — it is the canvas every tab sits beside (v5,
// "מפה חיה"). The route stays so that old links and the installed app's
// shortcuts still land somewhere sensible.
export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(tripTabHref(id, "days"));
}
