import { listChatMessages, MoreBackLink, TripChat } from "@/features/trips";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const messages = await listChatMessages(id);

  return (
    <>
      <MoreBackLink tripId={id} />
      <h2 className="font-display text-xl">שיחה</h2>
      <TripChat tripId={id} initialMessages={messages} />
    </>
  );
}
