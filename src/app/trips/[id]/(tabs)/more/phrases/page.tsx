import { getPhrasebook, MoreBackLink, Phrasebook } from "@/features/trips";

export default async function PhrasesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phrasebook = await getPhrasebook(id);

  return (
    <>
      <MoreBackLink tripId={id} />
      <Phrasebook tripId={id} initialPhrasebook={phrasebook} />
    </>
  );
}
