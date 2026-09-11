import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/ui";
import {
  GearList,
  MoreBackLink,
  getTrip,
  listGear,
} from "@/features/trips";

export const metadata = { title: "ציוד" };

export default async function GearPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Together rather than one after the other: the list does not depend on the
  // trip row, so making it wait for one turned this page into two round trips.
  const [trip, items] = await Promise.all([getTrip(id), listGear(id)]);
  if (!trip) notFound();

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="רשימה שאתם ממלאים בעצמכם. שום דבר כאן לא נוצר או נמחק אוטומטית."
      >
        ציוד
      </SectionHeading>

      <GearList tripId={trip.id} items={items} />
    </>
  );
}
