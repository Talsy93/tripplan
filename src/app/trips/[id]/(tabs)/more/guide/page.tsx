import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/ui";
import { getTrip, MoreBackLink, WorkflowGuide } from "@/features/trips";

export const metadata = { title: "איך זה עובד" };

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Read so the guide 404s for a trip that is not the caller's, like every
  // other screen under this layout — the links it renders are trip-scoped.
  const trip = await getTrip(id);
  if (!trip) notFound();

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="שבעה שלבים, בסדר שבו כדאי לעשות אותם. כל שלב מקשר למסך שבו הוא קורה."
      >
        איך זה עובד
      </SectionHeading>

      <WorkflowGuide tripId={trip.id} />
    </>
  );
}
