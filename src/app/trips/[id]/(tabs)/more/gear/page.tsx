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
  const trip = await getTrip(id);
  if (!trip) notFound();

  const items = await listGear(id);

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
